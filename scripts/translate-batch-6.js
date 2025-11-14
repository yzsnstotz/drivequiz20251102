// 继续批量翻译更多问题 - 第六批
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 更多翻译映射
const translations = {
  // 问题180
  '34. 因为自动变速车的基本要领是操作加速踏板和刹车踏板，所以不必特别注意变速杆的操作。': {
    en: '34. Because the basic principle of automatic transmission vehicles is to operate the accelerator and brake pedals, you do not need to pay special attention to gear lever operation.',
    ja: '34. オートマチック車の基本要領はアクセルペダルとブレーキペダルの操作であるため、シフトレバーの操作に特に注意する必要はありません。'
  },
  // 问题181
  '35. 该标志指禁止车辆进入，不能从有标志的方向进入。': {
    en: '35. This sign indicates that vehicle entry is prohibited; you cannot enter from the direction where the sign is located.',
    ja: '35. この標識は車両進入禁止を指し、標識がある方向から進入することはできません。'
  },
  // 问题182
  '36. 在没有车辆通行带的道路上，除了超车等不得已的情况以外，要靠道路的左侧通行。': {
    en: '36. On roads without vehicle lanes, except in unavoidable circumstances such as overtaking, you should travel on the left side of the road.',
    ja: '36. 車両通行帯のない道路では、追い越しなどのやむを得ない場合を除き、道路の左側を通行すべきです。'
  },
  // 问题183
  '37. 通过铁路道内时，为了防止发动机熄火，最好尽早变速一气通过。': {
    en: '37. When passing through a railway crossing, to prevent engine stalling, it is best to shift gears early and pass through in one go.',
    ja: '37. 踏切内を通過する際は、エンジンの停止を防ぐため、できるだけ早く変速して一気に通過するのが良いです。'
  },
  // 问题184
  '38. 汽车驾驶员不得做产生较大噪音等明显给他人带来麻烦的急起动、急加速及空转。': {
    en: '38. Vehicle drivers must not perform sudden starts, sudden acceleration, or idling that produces loud noise and clearly causes trouble to others.',
    ja: '38. 自動車の運転者は、大きな騒音を発生させるなど、明らかに他人に迷惑をかける急発進、急加速、アイドリングをしてはいけません。'
  },
  // 问题185
  '39. 超车时，首先要边向右侧靠近边打开右侧方向指示灯，其次最好用眼睛确认后方的安全。': {
    en: '39. When overtaking, first approach the right side while turning on the right turn signal, and second, it is best to visually confirm safety behind.',
    ja: '39. 追い越しの際は、まず右側に寄りながら右方向指示器を点灯し、次に目視で後方の安全を確認するのが良いです。'
  },
  // 问题186
  '40. 不得向即将驾驶的人敬酒或劝酒。': {
    en: '40. You must not offer or encourage alcohol to someone who is about to drive.',
    ja: '40. これから運転する人に酒を勧めたり、飲酒を促したりしてはいけません。'
  },
  // 问题187
  '41. 该标志表示路基容易塌落，需要注意。': {
    en: '41. This sign indicates that the roadbed is prone to collapse and requires attention.',
    ja: '41. この標識は、路盤が崩れやすいことを示し、注意が必要です。'
  },
  // 问题188
  '42. 因为停在车站的公共汽车通过方向指示灯等发出了起动信号，所以缓行让公共汽车先起动了。': {
    en: '42. Because the bus stopped at the station signaled its start through turn signals, I slowed down to let the bus start first.',
    ja: '42. 停留所に停車しているバスが方向指示器などで発進の信号を出したため、徐行してバスを先に発進させました。'
  },
  // 问题189
  '43. 在上坡的坡顶附近及陡下坡处必须缓行。': {
    en: '43. You must slow down near the top of uphill slopes and on steep downhill slopes.',
    ja: '43. 上り坂の頂上付近および急な下り坂では徐行しなければなりません。'
  },
  // 问题190
  '44. 超越前面的车辆时，必须鸣笛引起对方注意后超车。': {
    en: '44. When overtaking a vehicle ahead, you must sound the horn to alert it before overtaking.',
    ja: '44. 前方の車両を追い越す際は、クラクションで注意を促した後、追い越さなければなりません。'
  },
  // 问题191
  '45. 装有防锁死刹车系统的车辆急刹车时，如果不一气用力踩下刹车并一直踩住的话，系统就不动作。': {
    en: '45. When braking suddenly in a vehicle equipped with an anti-lock braking system, if you do not step on the brake firmly in one go and keep it pressed, the system will not activate.',
    ja: '45. アンチロックブレーキシステムを装備した車両で急ブレーキをかける際、一気に強くブレーキを踏み続けないと、システムが作動しません。'
  },
  // 问题192
  '46. 该标志表示前方道路是下陡坡。': {
    en: '46. This sign indicates that the road ahead is a steep downhill slope.',
    ja: '46. この標識は、前方の道路が急な下り坂であることを示しています。'
  },
  // 问题193
  '47. 在交叉路准备左转弯时，必须尽量提前靠近道路的左侧，紧贴交叉路中心的外侧（根据标志指定有通行场所时，在其指定的场所）缓行。': {
    en: '47. When preparing to turn left at an intersection, you must approach the left side of the road as early as possible, and proceed slowly close to the outside of the intersection center (or at the designated location if specified by signs).',
    ja: '47. 交差点で左折の準備をする際は、できるだけ早く道路の左側に寄り、交差点の中央の外側（標識で通行場所が指定されている場合は、その指定された場所）に沿って徐行しなければなりません。'
  },
  // 问题194
  '48. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '48. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '48. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题195
  '49. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '49. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '49. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题196
  '50. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '50. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '50. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题197
  '51. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '51. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '51. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题198
  '52. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '52. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '52. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
  },
  // 问题199
  '53. 取得中型驾驶执照的人可以驾驶乘车定员为30人的巴士。': {
    en: '53. A person who has obtained a medium-sized vehicle license can drive a bus with a seating capacity of 30 people.',
    ja: '53. 中型免許を取得した者は、乗車定員30人のバスを運転できます。'
  },
  // 问题200
  '54. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '54. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '54. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题201
  '55. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '55. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '55. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题202
  '56. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '56. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '56. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题203
  '57. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '57. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '57. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题204
  '58. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '58. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '58. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
  },
  // 问题205
  '59. 取得中型驾驶执照的人可以驾驶乘车定员为30人的巴士。': {
    en: '59. A person who has obtained a medium-sized vehicle license can drive a bus with a seating capacity of 30 people.',
    ja: '59. 中型免許を取得した者は、乗車定員30人のバスを運転できます。'
  },
  // 问题206
  '60. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '60. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '60. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题207
  '61. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '61. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '61. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题208
  '62. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '62. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '62. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题209
  '63. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '63. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '63. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题210
  '64. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '64. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '64. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
  }
};

// 处理问题
let updated = 0;
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const zhContent = q.content.zh;
  
  if (translations[zhContent]) {
    q.content.en = translations[zhContent].en;
    q.content.ja = translations[zhContent].ja;
    updated++;
    console.log(`已更新问题 ${i + 1} (ID: ${q.id})`);
  }
}

// 保存文件
if (updated > 0) {
  console.log(`\n保存文件，已更新 ${updated} 个问题...`);
  fs.writeFileSync(INPUT_FILE, JSON.stringify(questions, null, 2), 'utf-8');
  console.log('完成！');
} else {
  console.log('没有需要更新的问题');
}

// 统计
let translated = 0;
let needsTranslation = 0;
questions.forEach(q => {
  if (!q.content.en.startsWith('[EN]') && !q.content.ja.startsWith('[JA]')) {
    translated++;
  } else {
    needsTranslation++;
  }
});

console.log(`\n当前进度:`);
console.log(`  已翻译: ${translated}/${questions.length} (${((translated / questions.length) * 100).toFixed(2)}%)`);
console.log(`  待翻译: ${needsTranslation}/${questions.length} (${((needsTranslation / questions.length) * 100).toFixed(2)}%)`);

