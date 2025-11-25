const fs = require('fs');
const path = require('path');

// 润色题目的函数 - 更智能的版本
function polishContent(content) {
  let polished = content;
  
  // 保存题目编号
  const numberMatch = polished.match(/^(\d+[\.、]\s*)/);
  const numberPrefix = numberMatch ? numberMatch[1] : '';
  polished = polished.replace(/^\d+[\.、]\s*/, '');
  
  // 1. 修复常见的错别字和表达问题
  polished = polished.replace(/坊碍/g, '妨碍');
  polished = polished.replace(/摩托托车/g, '摩托车');
  polished = polished.replace(/停泊车/g, '停车');
  polished = polished.replace(/申考/g, '申请考取');
  polished = polished.replace(/政令指定教程/g, '政府指定的培训课程');
  polished = polished.replace(/同乘者/g, '乘客');
  polished = polished.replace(/驾驶执照/g, '驾驶证');
  polished = polished.replace(/执照/g, '驾驶证');
  polished = polished.replace(/警察署/g, '警察局');
  polished = polished.replace(/单行线/g, '单行道');
  polished = polished.replace(/图示/g, '图中所示');
  polished = polished.replace(/按箭头指向/g, '按照箭头方向');
  polished = polished.replace(/改变车道/g, '变更车道');
  polished = polished.replace(/车辆通行带/g, '车道');
  polished = polished.replace(/优先道路/g, '优先通行道路');
  polished = polished.replace(/放慢速度/g, '减速');
  
  // 2. 统一术语表达
  polished = polished.replace(/交叉路(?!口)/g, '交叉路口');
  polished = polished.replace(/缓行/g, '慢行');
  polished = polished.replace(/暂时停车/g, '临时停车');
  
  // 3. 修复语法问题
  // 修复"在...的时候"的重复
  polished = polished.replace(/在([^在]*?)的时候([^在]*?)在([^在]*?)的时候/g, (match, p1, p2, p3) => {
    // 如果两个"的时候"距离很近，合并
    if (p2.length < 20) {
      return `在${p1}${p2}${p3}时`;
    }
    return match;
  });
  
  // 修复"因"后面缺少"为"
  polished = polished.replace(/因([^为])/g, '因为$1');
  
  // 修复"想"改为"要"（在某些语境下）
  polished = polished.replace(/想在([^想]*?)的时候/g, '要$1时');
  polished = polished.replace(/想在([^想]*?)，/g, '要$1，');
  polished = polished.replace(/要在右转弯时/g, '要右转弯时');
  polished = polished.replace(/要在左转弯时/g, '要左转弯时');
  
  // 4. 修复表达不通顺的地方
  // "在交叉路中停下来了" -> "在交叉路口停下来"
  polished = polished.replace(/在交叉路口中?停下来了/g, '在交叉路口停下来');
  polished = polished.replace(/在交叉路口中?停下来/g, '在交叉路口停下来');
  polished = polished.replace(/在交叉路中停下来/g, '在交叉路口停下来');
  polished = polished.replace(/此时在交叉路口停下来了/g, '此时在交叉路口停下来');
  
  // "停在信号灯的跟前" -> "停在信号灯前方"
  polished = polished.replace(/停在信号灯的跟前/g, '停在信号灯前方');
  polished = polished.replace(/是停在信号灯的跟前/g, '应该停在信号灯前方');
  polished = polished.replace(/是停灯的前方/g, '应该停在信号灯前方');
  
  // "已接近停止位置如果不紧急刹车不能停下来的时候" -> "已接近停止位置，如果不紧急刹车无法停下来时"
  polished = polished.replace(/已接近停止位置如果不紧急刹车不能停下来的时候/g, '已接近停止位置，如果不紧急刹车无法停下来时');
  
  // "因对面是绿灯进入了交叉路" -> "因为对面是绿灯而进入了交叉路口"
  polished = polished.replace(/因对面是绿灯进入了交叉路/g, '因为对面是绿灯而进入了交叉路口');
  polished = polished.replace(/因为对面是绿灯进入了交叉路口/g, '因为对面是绿灯而进入了交叉路口');
  
  // "但右转弯方向的信号是红灯时" -> "但右转弯方向的信号灯是红灯时"
  polished = polished.replace(/信号是红灯/g, '信号灯是红灯');
  polished = polished.replace(/信号是绿灯/g, '信号灯是绿灯');
  polished = polished.replace(/信号是黄灯/g, '信号灯是黄灯');
  
  // "可以超出右侧车线" -> "可以越过右侧车道线"
  polished = polished.replace(/超出右侧车线/g, '越过右侧车道线');
  
  // "禁止泊车的标志" -> "禁止停车的标志"
  polished = polished.replace(/禁止泊车/g, '禁止停车');
  
  // "未必一定" -> "不一定"
  polished = polished.replace(/未必一定/g, '不一定');
  
  // "合法1年" -> "满1年"
  polished = polished.replace(/合法(\d+)年/g, '满$1年');
  
  // "视线都较差" -> "视线都不好"
  polished = polished.replace(/视线都较差/g, '视线都不好');
  polished = polished.replace(/视线较差/g, '视线不好');
  
  // "标志的对面(背面)" -> "标志的背面"
  polished = polished.replace(/标志的对面\(背面\)/g, '标志的背面');
  polished = polished.replace(/标志的对面/g, '标志的背面');
  
  // "不得从正面通行" -> "不能从正面通行"
  polished = polished.replace(/不得从正面通行/g, '不能从正面通行');
  
  // "不越过右侧道路部分" -> "不越过道路右侧"
  polished = polished.replace(/不越过右侧道路部分/g, '不越过道路右侧');
  
  // "属于...的交叉路" -> "...的交叉路口"
  polished = polished.replace(/属于([^属]*?)的交叉路/g, '$1的交叉路口');
  
  // "必须缓行" -> "必须慢行"
  polished = polished.replace(/必须缓行/g, '必须慢行');
  
  // "可以按箭头指向改变车道" -> "可以按照箭头方向变更车道"
  polished = polished.replace(/可以按箭头指向改变车道/g, '可以按照箭头方向变更车道');
  
  // "不能停泊车或临时停车" -> "不能停车或临时停车"
  polished = polished.replace(/不能停泊车或临时停车/g, '不能停车或临时停车');
  
  // "车辆可以从标志的对面(背面)进入" -> "车辆可以从标志的背面进入"
  polished = polished.replace(/车辆可以从标志的对面\(背面\)进入/g, '车辆可以从标志的背面进入');
  
  // "但是不得从正面通行" -> "但不能从正面通行"
  polished = polished.replace(/但是不得从正面通行/g, '但不能从正面通行');
  
  // 5. 修复标点符号
  // 确保句子有适当的标点
  if (!/[。！？]$/.test(polished.trim())) {
    polished = polished.trim() + '。';
  }
  
  // 修复多余的逗号
  polished = polished.replace(/，([，。])/g, '$1');
  
  // 6. 修复"的"的用法
  // "停灯的前方" -> "停在信号灯前方"
  polished = polished.replace(/停灯的前方/g, '停在信号灯前方');
  
  // 7. 修复其他表达问题
  // "在安全地带的旁边通过时" -> "从安全地带旁边通过时"
  polished = polished.replace(/在安全地带的旁边通过时/g, '从安全地带旁边通过时');
  
  // "从停车的机动车旁边通过时" -> "从停放的机动车旁边通过时"
  polished = polished.replace(/从停车的机动车旁边通过时/g, '从停放的机动车旁边通过时');
  
  // "有行人在人行横道横穿道路时" -> "有行人在人行横道上横穿道路时"
  polished = polished.replace(/有行人在人行横道横穿道路时/g, '有行人在人行横道上横穿道路时');
  
  // "从正在上下车的学校、幼儿园校车旁边通过时" -> "从正在上下学生的学校、幼儿园校车旁边通过时"
  polished = polished.replace(/从正在上下车的学校/g, '从正在上下学生的学校');
  
  // "从后面看" -> "从后方看"
  polished = polished.replace(/从后面看/g, '从后方看');
  
  // "准备在交叉路左转弯时" -> "准备在交叉路口左转弯时"
  polished = polished.replace(/准备在交叉路左转弯时/g, '准备在交叉路口左转弯时');
  
  // "改变车道、掉头、倒车等行为结束时" -> "变更车道、掉头、倒车等操作结束时"
  polished = polished.replace(/改变车道、掉头、倒车等行为结束时/g, '变更车道、掉头、倒车等操作结束时');
  
  // "即使是在用黄线划分车道通行带的地方" -> "即使是在用黄线划分车道的地方"
  polished = polished.replace(/车道通行带/g, '车道');
  
  // "在坊碍交通的时候" -> "在妨碍交通时"
  polished = polished.replace(/在坊碍交通的时候/g, '在妨碍交通时');
  
  // "在坡度大的下坡禁止超车" -> "在坡度较大的下坡路段禁止超车"
  polished = polished.replace(/在坡度大的下坡禁止超车/g, '在坡度较大的下坡路段禁止超车');
  polished = polished.replace(/在坡度大的上坡不禁止超车/g, '在坡度较大的上坡路段不禁止超车');
  
  // "交叉路及其跟前30米以内" -> "交叉路口及其前方30米以内"
  polished = polished.replace(/交叉路及其跟前(\d+)米以内/g, '交叉路口及其前方$1米以内');
  
  // "在视线较好的铁路道" -> "在视线良好的铁路道口"
  polished = polished.replace(/在视线较好的铁路道/g, '在视线良好的铁路道口');
  
  // "为紧急车辆让行时" -> "为紧急车辆让路时"
  polished = polished.replace(/为紧急车辆让行时/g, '为紧急车辆让路时');
  
  // "在交叉路附近以外的道路" -> "在交叉路口附近以外的道路"
  polished = polished.replace(/在交叉路附近以外的道路/g, '在交叉路口附近以外的道路');
  
  // "在设有公交车等专用车道的道路上" -> "在设有公交车等专用车道的道路上"
  // 这个已经比较通顺，保持原样
  
  // "右转弯时，如果反方向有直行车辆驶来" -> "右转弯时，如果对向有直行车辆驶来"
  polished = polished.replace(/反方向有直行车辆/g, '对向有直行车辆');
  
  // "在交叉路按指定机动汽车道路行驶" -> "在交叉路口按指定的机动车道行驶"
  polished = polished.replace(/在交叉路按指定机动汽车道路行驶/g, '在交叉路口按指定的机动车道行驶');
  
  // "在前车要转弯、发出改变车道的信号时" -> "在前车要转弯、发出变更车道的信号时"
  polished = polished.replace(/发出改变车道的信号/g, '发出变更车道的信号');
  
  // "内轮差是指，汽车在右转弯时，后轮比前轮更靠外侧" -> "内轮差是指，汽车在右转弯时，后轮比前轮更靠内侧"
  // 注意：这个需要根据实际情况判断，如果是错误的题目，保持原样
  
  // "在普通道路的法定最高速度" -> "在普通道路上，法定最高速度"
  polished = polished.replace(/在普通道路的法定最高速度/g, '在普通道路上，法定最高速度');
  
  // "申考大型驾驶证的原则需具备以下条件" -> "申请考取大型驾驶证需要具备以下条件"
  polished = polished.replace(/申考大型驾驶证的原则需具备以下条件/g, '申请考取大型驾驶证需要具备以下条件');
  
  // "取得普通驾驶证期间合计3年及以上" -> "取得普通驾驶证累计满3年及以上"
  polished = polished.replace(/取得普通驾驶证期间合计(\d+)年/g, '取得普通驾驶证累计满$1年');
  
  // "取得普通驾驶证期间合法1年及以上" -> "取得普通驾驶证满1年及以上"
  polished = polished.replace(/取得普通驾驶证期间合法(\d+)年/g, '取得普通驾驶证满$1年');
  
  // "腰部安全带如系在腹部而非腰部位置" -> "腰部安全带如果系在腹部而非腰部位置"
  polished = polished.replace(/腰部安全带如系在/g, '腰部安全带如果系在');
  
  // "乘坐副驾驶座位的人必须使用安全带" -> "坐在副驾驶座位的人必须使用安全带"
  polished = polished.replace(/乘坐副驾驶座位的人/g, '坐在副驾驶座位的人');
  
  // "坐在后部座位的人不必使用" -> "坐在后排座位的人不必使用"
  polished = polished.replace(/坐在后部座位的人/g, '坐在后排座位的人');
  
  // "在如图所示道路上" -> "在图中所示的道路上"
  polished = polished.replace(/在如图所示道路上/g, '在图中所示的道路上');
  
  // "A车超B车时" -> "A车超越B车时"
  polished = polished.replace(/A车超B车时/g, 'A车超越B车时');
  
  // "不得超出中央线在右侧部分行驶" -> "不能越过中央线在右侧部分行驶"
  polished = polished.replace(/不得超出中央线/g, '不能越过中央线');
  
  // "同一方向有三条车道行驶带时" -> "同一方向有三条车道时"
  polished = polished.replace(/车道行驶带/g, '车道');
  
  // "最右侧为超车用通行带" -> "最右侧为超车专用车道"
  polished = polished.replace(/超车用通行带/g, '超车专用车道');
  
  // "应让开行驶" -> "应该让出"
  polished = polished.replace(/应让开行驶/g, '应该让出');
  
  // "车速慢的在左侧通行带行驶" -> "车速慢的应在左侧车道行驶"
  polished = polished.replace(/车速慢的在左侧通行带行驶/g, '车速慢的应在左侧车道行驶');
  
  // "车速快的在右侧通行带行驶" -> "车速快的应在右侧车道行驶"
  polished = polished.replace(/车速快的在右侧通行带行驶/g, '车速快的应在右侧车道行驶');
  
  // "在不得已的情况下" -> "在不得已的情况下"
  // 这个已经比较通顺，保持原样
  
  // "可以在安全地带行驶" -> "可以在安全地带内行驶"
  polished = polished.replace(/可以在安全地带行驶/g, '可以在安全地带内行驶');
  
  // "为进出临近道路的场所内横穿人行道和路侧带时" -> "为进出临近道路的场所而横穿人行道和路侧带时"
  polished = polished.replace(/为进出临近道路的场所内横穿/g, '为进出临近道路的场所而横穿');
  
  // "不必在人行道和路侧带前暂时停车" -> "不必在人行道和路侧带前临时停车"
  polished = polished.replace(/不必在人行道和路侧带前暂时停车/g, '不必在人行道和路侧带前临时停车');
  
  // "有图中标志的道路" -> "有图中所示标志的道路"
  polished = polished.replace(/有图中标志的道路/g, '有图中所示标志的道路');
  
  // "原则禁止车辆通行" -> "原则上禁止车辆通行"
  polished = polished.replace(/原则禁止/g, '原则上禁止');
  
  // "但在路旁有车库的车辆等" -> "但对于路旁有车库的车辆等"
  polished = polished.replace(/但在路旁有车库的车辆等/g, '但对于路旁有车库的车辆等');
  
  // "取得警察署的许可后" -> "取得警察局的许可后"
  polished = polished.replace(/取得警察署的许可后/g, '取得警察局的许可后');
  
  // "车辆可缓行通过" -> "车辆可以慢行通过"
  polished = polished.replace(/车辆可缓行通过/g, '车辆可以慢行通过');
  
  // 恢复题目编号
  if (numberPrefix) {
    polished = numberPrefix + polished;
  }
  
  return polished.trim();
}

// 生成更具体的解释
function generateExplanation(question) {
  const { content, correctAnswer, type } = question;
  
  // 移除题目编号
  let cleanContent = content.replace(/^\d+[\.、]\s*/, '');
  
  if (type === 'truefalse') {
    // 根据题目内容生成更具体的解释
    if (correctAnswer === 'true') {
      // 对于正确的题目，解释为什么正确
      if (cleanContent.includes('礼让') || cleanContent.includes('照顾')) {
        return '正确。驾驶时应相互礼让，照顾其他车辆和行人，这是安全驾驶的基本要求。';
      } else if (cleanContent.includes('黄灯') && cleanContent.includes('紧急刹车')) {
        return '正确。当接近停止线时，如果紧急刹车可能导致危险，可以在黄灯时通过，但必须确保安全。';
      } else if (cleanContent.includes('信号灯') && cleanContent.includes('停止位置')) {
        return '正确。在没有停止线的情况下，停止位置应在信号灯前方，而不是紧贴信号灯。';
      } else if (cleanContent.includes('标志')) {
        return '正确。该标志的含义如题目所述，符合交通标志的规定。';
      } else if (cleanContent.includes('驾驶证') || cleanContent.includes('执照')) {
        return '正确。关于驾驶证的规定如题目所述，符合相关法律法规。';
      } else if (cleanContent.includes('速度') || cleanContent.includes('时速')) {
        return '正确。关于速度限制的规定如题目所述，必须严格遵守。';
      } else if (cleanContent.includes('超车')) {
        return '正确。关于超车的规定如题目所述，必须遵守相关交通规则。';
      } else if (cleanContent.includes('让行') || cleanContent.includes('让路')) {
        return '正确。遇到紧急车辆或其他特殊情况时，应主动让行，确保安全。';
      } else {
        return `正确。${cleanContent.replace(/[。！？]$/, '')}，这是符合交通法规和安全驾驶要求的。`;
      }
    } else {
      // 对于错误的题目，解释为什么错误
      if (cleanContent.includes('信号灯') && cleanContent.includes('红灯') && (cleanContent.includes('停下来') || cleanContent.includes('停车'))) {
        return '错误。在交叉路口内不应停车，应在进入交叉路口前根据信号灯指示决定是否通行。如果右转弯方向的信号灯是红灯，应在进入交叉路口前停车等待。';
      } else if (cleanContent.includes('停止位置') && (cleanContent.includes('信号灯的跟前') || cleanContent.includes('信号灯前方'))) {
        return '错误。在没有停止线的情况下，停止位置应在交叉路口入口处，而不是信号灯前方。';
      } else if (cleanContent.includes('安全速度') && cleanContent.includes('法定速度')) {
        return '错误。安全速度是指根据道路、天气、交通状况等因素确定的合适速度，不一定等于法定最高速度。';
      } else if (cleanContent.includes('上坡') && cleanContent.includes('缓行场所')) {
        return '错误。上坡路段不属于缓行场所，缓行场所通常指学校、医院等特定区域。';
      } else if (cleanContent.includes('行人') && cleanContent.includes('缓行')) {
        return '错误。从行人旁边通过时，应根据情况适当减速，但不一定必须缓行。';
      } else if (cleanContent.includes('校车') && cleanContent.includes('暂时停车')) {
        return '错误。从正在上下学生的校车旁边通过时，必须停车等待，不能只是减速。';
      } else if (cleanContent.includes('信号') && cleanContent.includes('3秒钟')) {
        return '错误。转弯信号应在转弯前约30米（约3秒）发出，而不是3秒钟。';
      } else if (cleanContent.includes('取消') && cleanContent.includes('3秒钟')) {
        return '错误。信号应在操作完成后立即取消，而不是等待3秒钟。';
      } else if (cleanContent.includes('黄线') && cleanContent.includes('改变车道')) {
        return '错误。黄线通常表示禁止越线，即使是为了转弯，也不应随意越过黄线。';
      } else if (cleanContent.includes('内轮差') && cleanContent.includes('外侧')) {
        return '错误。内轮差是指汽车转弯时，后轮比前轮更靠内侧，而不是外侧。';
      } else {
        return `错误。${cleanContent.replace(/[。！？]$/, '')}，实际情况并非如此，需要按照正确的交通规则来理解。`;
      }
    }
  }
  
  return '';
}

// 处理单个文件
function processFile(inputPath, outputPath) {
  console.log(`处理文件: ${inputPath}`);
  
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const processedQuestions = data.questions.map((question, index) => {
    // 润色题目内容
    const originalContent = question.content;
    let polishedContent = polishContent(originalContent);
    
    // 生成解释（如果为空）
    let explanation = question.explanation || '';
    if (!explanation || explanation.trim() === '') {
      explanation = generateExplanation({
        ...question,
        content: polishedContent
      });
    }
    
    return {
      ...question,
      content: polishedContent,
      explanation: explanation
    };
  });
  
  // 保持原有的文件结构
  const outputData = {
    ...data,
    questions: processedQuestions
  };
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 写入文件
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`已保存: ${outputPath} (${processedQuestions.length} 道题目)`);
}

// 主函数
function main() {
  const zhDir = path.join(__dirname, '../src/data/questions/zh');
  const zhbDir = path.join(__dirname, '../src/data/questions/zhb');
  
  // 确保输出目录存在
  if (!fs.existsSync(zhbDir)) {
    fs.mkdirSync(zhbDir, { recursive: true });
  }
  
  // 读取所有JSON文件
  const files = fs.readdirSync(zhDir).filter(file => file.endsWith('.json'));
  
  console.log(`找到 ${files.length} 个文件`);
  
  // 处理每个文件
  files.forEach(file => {
    const inputPath = path.join(zhDir, file);
    const outputPath = path.join(zhbDir, file);
    processFile(inputPath, outputPath);
  });
  
  console.log('\n处理完成！');
  console.log(`输入目录: ${zhDir}`);
  console.log(`输出目录: ${zhbDir}`);
  console.log(`处理文件数: ${files.length}`);
}

main();
