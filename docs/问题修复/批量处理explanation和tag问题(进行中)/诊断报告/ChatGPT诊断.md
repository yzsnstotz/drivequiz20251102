先把这次这个「只指定 ID=1，一体化 full_pipeline」的现象跟之前的诊断报告对上了，结论是：三个问题都还在，但位置已经可以比较精确地锁定了：

1. 1 号题的中文 explanation 被写成英文

日志里可以看到 full_pipeline 里已经走了你加的那段「源语言 explanation 写入逻辑」，并打印了
sourceExplanation 已写入到 explanation[zh]。

按照设计，这里应该先用 isEnglishContent 拦一遍：如果 sourceLanguage === "zh" 且内容是英文，就要跳过覆盖。

但从这次运行日志看，没有任何「⚠️ AI 返回 explanation 为英文，跳过覆盖」的 warning，说明当前运行路径里要么没有真正走到 isEnglishContent 的分支，要么 isEnglishContent 仍然判断失败，导致 AI 返回的英文 explanation 直接覆盖了 explanation.zh——这就是你看到 1 号题中文 explanation 变成英文的直接原因。

简单说：full_pipeline 里写入源语言 explanation 的那一段，语言检测还没真正挡住英文内容，导致英文依然被写进 zh key。

2. tag 没有写回到题库上

日志里已经能看到：
tags 应用完成: {...} 和 question 对象上的 tags: { license_type_tag: undefined, stage_tag: 'regular', topic_tags: [...] }。
这说明：
1）AI 返回了 tags；
2）applyTagsFromFullPipeline 对内存里的 question 做了赋值，但 license_type_tag 这一项仍是 undefined。

在保存阶段，saveQuestionToDb 目前是用
license_tags: (question as any).license_type_tag || question.license_tags
写入数据库。
也就是说：

如果内存对象上的 license_type_tag 没被正确填好，就会退回去用旧字段 license_tags；

再叠加上部分路径（比如 category_tags 操作）直接用老的更新语句，没有统一走 saveQuestionToDb。

现实结果就是：日志上看「打过 tag」，但真正写入 DB 的字段和你现在看的字段（尤其是 license_type_tag JSONB）不一致，或者压根没写到那一列上，所以你在题库里看到的是「没有 tag」。

简单说：打 tag 只打在内存对象 + 老字段上，落库时字段名和路径还没完全统一，所以你在数据库里看不到预期的 tag。

3. 多出来一个 1377 题（原来只有 1376 题）

这个现象和诊断报告里的「问题3：指定任务完成后仍处理未指定题目」其实是同一类根源：保存路径在做 insert/update 时没有再用指定的 questionIds 做防护。

在当前实现里，saveQuestionToDb 是根据传入的 id 来决定走 update 还是 insert 的：

如果 id 丢了 / 变成 undefined / 被 AI 返回的结构覆盖成别的值，就会走 insert，

PG 就会自动生成一个新的自增 ID（这就是你看到的 1377、1399 这样的「幽灵题」）。

结合这次测试：你只指定了 ID=1，但在某个路径（尤其是翻译结果或 tags 保存时）很可能重新根据 DB 取了一次题目，或者使用了没有 id 的合并对象，saveQuestionToDb 在这种情况下就当成「新题」插进了 questions 表，于是产生了「本来没有的 1377，并且带着新 explanation 和 tag」。

简单说：保存函数仍然允许在 full_pipeline 过程中「悄悄新建题」，一旦中间步骤把 question.id 搞丢/搞错，就会插入 1377 这样新的题目。

如果用一句话概括这次的定位结果：

现在的 full_pipeline 在「语言检测 + tag 落库 + 保存方式」三个点上都还各留了一条“旁门路径”：
1）源语言 explanation 写入有检测，但这次没生效；
2）tag 打在内存和旧字段上，和你查看的字段不一致；
3）保存函数允许在批处理里插入新题，没用 questionIds 做最终防护，所以会长出 1377 / 1399 这样的幽灵题。