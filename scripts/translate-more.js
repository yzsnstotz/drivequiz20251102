// 继续翻译更多问题
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
  // 问题6
  '6. 这个标示表示禁止掉头路段"结束"。': {
    en: '6. This sign indicates the end of a "no U-turn" section.',
    ja: '6. この標識は「転回禁止」区間の「終了」を表します。'
  },
  // 问题21
  '20. 从停车的机动车旁边通过时，有时车门会突然打开，或者突然从车后冲出行人，必须减速谨慎通行。': {
    en: '20. When passing a parked motor vehicle, doors may suddenly open or pedestrians may rush out from behind the vehicle, so you must slow down and proceed with caution.',
    ja: '20. 停車中の自動車の横を通り過ぎる際、ドアが突然開いたり、車の後ろから歩行者が飛び出したりすることがあるため、減速して慎重に通行しなければなりません。'
  },
  // 问题22
  '21. 有行人在人行横道横穿道路时，但在车辆接近时行人停下来，所以车辆继续通行。': {
    en: '21. When a pedestrian is crossing the road at a crosswalk, but the pedestrian stops as the vehicle approaches, the vehicle may continue.',
    ja: '21. 歩行者が横断歩道で道路を横断しているが、車両が接近した際に歩行者が停止した場合、車両は通行を続けることができる。'
  },
  // 问题23
  '22. 从正在上下车的学校、幼儿园校车旁边通过时，必须暂时停车确认安全。': {
    en: '22. When passing a school or kindergarten bus that is loading or unloading passengers, you must stop temporarily to confirm safety.',
    ja: '22. 乗降中の学校・幼稚園のスクールバスの横を通り過ぎる際は、安全を確認するため一時停止しなければなりません。'
  },
  // 问题24
  '23. 对于贴有此图标的车，因为危险，禁止超车和追车。': {
    en: '23. For vehicles displaying this icon, overtaking and tailgating are prohibited due to danger.',
    ja: '23. このアイコンを表示している車両については、危険のため追い越しと追従が禁止されています。'
  },
  // 问题25
  '24. 从后面看，图中的手势信号是右转弯、掉头或在同一方向行驶中向右改变车道的信号。': {
    en: '24. From behind, the hand signal in the figure indicates a right turn, U-turn, or changing lanes to the right while traveling in the same direction.',
    ja: '24. 後ろから見て、図中の手信号は右折、転回、または同一方向進行中の右側車線変更の信号です。'
  },
  // 问题26
  '25. 准备在交叉路左转弯时，必须在转弯前约3秒钟发出左转弯的信号。': {
    en: '25. When preparing to make a left turn at an intersection, you must signal the left turn approximately 3 seconds before turning.',
    ja: '25. 交差点で左折する準備をする際は、曲がる約3秒前に左折の信号を出さなければなりません。'
  },
  // 问题27
  '26. 改变车道、掉头、倒车等行为结束时，必须在经过约3秒钟之后取消该信号。': {
    en: '26. When changing lanes, making a U-turn, reversing, or other maneuvers are completed, you must cancel the signal after approximately 3 seconds.',
    ja: '26. 車線変更、転回、後退などの行為が終了した際は、約3秒経過後に信号を解除しなければなりません。'
  },
  // 问题28
  '27. 即使是在用黄线划分车道通行带的地方，如果是为了左右转弯，就可以越过该线改变车道。': {
    en: '27. Even in places where lanes are divided by yellow lines, you may cross the line to change lanes if it is for making left or right turns.',
    ja: '27. 黄線で車線通行帯が区画されている場所でも、左右折のためであれば、その線を越えて車線変更することができます。'
  },
  // 问题29
  '28. 在坊碍交通的时候，即使在未禁止的地方，也不能横穿道路或掉头。': {
    en: '28. When obstructing traffic, you cannot cross the road or make a U-turn even in places where it is not prohibited.',
    ja: '28. 交通を妨げる場合、禁止されていない場所であっても、道路を横断したり転回したりすることはできません。'
  },
  // 问题30
  '29. 在坡度大的下坡禁止超车，但是在坡度大的上坡不禁止超车。': {
    en: '29. Overtaking is prohibited on steep downhill slopes, but it is not prohibited on steep uphill slopes.',
    ja: '29. 勾配の大きい下り坂では追い越しが禁止されていますが、勾配の大きい上り坂では追い越しは禁止されていません。'
  },
  // 问题31
  '30. 交叉路及其跟前30米以内的场所，不能超车，但是在优先道路上行驶时可以超车。': {
    en: '30. Overtaking is not allowed at intersections and within 30 meters before them, but it is allowed when driving on priority roads.',
    ja: '30. 交差点およびその手前30メートル以内の場所では追い越しはできませんが、優先道路を走行している場合は追い越しが可能です。'
  },
  // 问题32
  '31. 在有图中标志的地方不能超车。': {
    en: '31. Overtaking is not allowed in places with the sign shown in the figure.',
    ja: '31. 図中の標識がある場所では追い越しはできません。'
  },
  // 问题33
  '32. 在前方道路有障碍物的时候，应当提前减速或停车，给对面来车让道。': {
    en: '32. When there is an obstacle on the road ahead, you should slow down or stop in advance to give way to oncoming vehicles.',
    ja: '32. 前方道路に障害物がある場合、対向車に道を譲るため、事前に減速または停車する必要があります。'
  },
  // 问题34
  '33. 在视线较好的铁路道，如果可以确认安全，则可以缓行通过。': {
    en: '33. At railway crossings with good visibility, if safety can be confirmed, you may proceed slowly.',
    ja: '33. 視界の良い踏切では、安全を確認できれば徐行して通過することができます。'
  },
  // 问题35
  '34. 为紧急车辆让行时，即使在单行线上，也必须将车辆靠向道路左侧。': {
    en: '34. When giving way to emergency vehicles, even on one-way streets, you must move your vehicle to the left side of the road.',
    ja: '34. 緊急車両に道を譲る際は、一方通行の道路であっても、車両を道路の左側に寄せなければなりません。'
  },
  // 问题36
  '25. 在交叉路附近以外的道路行驶的车辆，在有紧急车辆驶近时，如果靠左侧让行，一定要暂时停车': {
    en: '25. Vehicles traveling on roads other than near intersections must come to a temporary stop when giving way to approaching emergency vehicles by moving to the left.',
    ja: '25. 交差点付近以外の道路を走行する車両は、緊急車両が接近した際に左側に寄せて道を譲る場合、必ず一時停止しなければなりません。'
  },
  // 问题37
  '26. 在设有公交车等专用车道的道路上，车辆（小型特殊机动车、轻型摩托车、轻型车辆），除在转弯等不得已的情况外，不可在该车道行驶': {
    en: '26. On roads with dedicated lanes for buses and other vehicles, vehicles (small special motor vehicles, light motorcycles, light vehicles) may not drive in that lane except in unavoidable circumstances such as turning.',
    ja: '26. バス等の専用車線が設けられている道路では、車両（小型特殊自動車、原動機付自転車、軽車両）は、曲がりなどのやむを得ない場合を除き、その車線を走行することはできません。'
  },
  // 问题38
  '27. 右转弯时，如果反方向有直行车辆驶来，即使自己的车已先进入交叉路，也不可妨碍直行车的通行。': {
    en: '27. When making a right turn, if there is a vehicle going straight from the opposite direction, even if your vehicle has already entered the intersection, you must not obstruct the passage of the vehicle going straight.',
    ja: '27. 右折する際、対向方向から直進車両が来る場合、自分の車が先に交差点に入っていても、直進車の通行を妨げてはいけません。'
  },
  // 问题39
  '28. 在交叉路按指定机动汽车道路行驶，即使有紧急车辆接近也可以不必让行。': {
    en: '28. When driving on a designated motor vehicle road at an intersection, you do not need to give way even if an emergency vehicle is approaching.',
    ja: '28. 交差点で指定自動車道路を走行している場合、緊急車両が接近していても道を譲る必要はありません。'
  },
  // 问题40
  '29. 在前车要转弯、发出改变车道的信号时，除非必须急刹车或急打方向盘的情况外，不得妨碍其改变车道': {
    en: '29. When a vehicle ahead is about to turn or signals a lane change, you must not obstruct its lane change unless you must brake suddenly or turn the steering wheel sharply.',
    ja: '29. 前車が曲がろうとしたり、車線変更の信号を出した際は、急ブレーキや急ハンドルを切らなければならない場合を除き、その車線変更を妨げてはいけません。'
  },
  // 问题41
  '30. 内轮差是指，汽车在右转弯时，后轮比前轮更靠外侧。': {
    en: '30. Inner wheel difference refers to the fact that when a car makes a right turn, the rear wheels are positioned further outward than the front wheels.',
    ja: '30. 内輪差とは、自動車が右折する際、後輪が前輪よりも外側に位置することを指します。'
  },
  // 问题42
  '31. 在普通道路的法定最高速度，所有的机动车都是每小时60公里。': {
    en: '31. On ordinary roads, the legal maximum speed for all motor vehicles is 60 kilometers per hour.',
    ja: '31. 普通道路での法定最高速度は、すべての自動車で時速60キロメートルです。'
  },
  // 问题43
  '16. 申考大型驾驶证的原则需具备以下条件：年龄在21岁及以上，且取得普通驾驶证期间合计3年及以上。不过，若是修完政令指定教程的人员，19岁及以上且取得普通驾驶证期间合法1年及以上即可申考': {
    en: '16. The basic requirements for applying for a large vehicle license are: age 21 or older, and having held a regular driver\'s license for a total of 3 years or more. However, for those who have completed government-designated courses, those aged 19 or older who have legally held a regular driver\'s license for 1 year or more may apply.',
    ja: '16. 大型免許の申請原則として、以下の条件が必要です：年齢21歳以上、かつ普通免許取得期間が合計3年以上。ただし、政令指定教程を修了した者は、19歳以上で普通免許取得期間が合法的に1年以上あれば申請可能です。'
  },
  // 问题44
  '17. 腰部安全带如系在腹部而非腰部位置，一旦发生事故会受到强力压迫有危险，因此应该系在盆骨部位。': {
    en: '17. If a lap belt is worn at the abdomen rather than the waist, it can cause strong compression in an accident, which is dangerous, so it should be worn at the pelvic area.',
    ja: '17. 腰ベルトを腰ではなく腹部に装着すると、事故時に強い圧迫を受ける危険があるため、骨盤部に装着すべきです。'
  },
  // 问题45
  '17. 乘坐副驾驶座位的人必须使用安全带，但坐在后部座位的人不必使用。': {
    en: '17. Persons riding in the front passenger seat must use a seat belt, but those sitting in the rear seats do not need to use one.',
    ja: '17. 助手席に乗車する者はシートベルトを使用しなければなりませんが、後部座席に座る者は使用する必要はありません。'
  },
  // 问题46
  '19. 在如图所示道路上，A车超B车时，不得超出中央线在右侧部分行驶。': {
    en: '19. On the road shown in the figure, when vehicle A overtakes vehicle B, it must not drive beyond the center line on the right side.',
    ja: '19. 図示の道路では、A車がB車を追い越す際、中央線を越えて右側部分を走行してはいけません。'
  },
  // 问题47
  '20. 同一方向有三条车道行驶带时，最右侧为超车用通行带，应让开行驶，车速慢的在左侧通行带行驶，车速快的在右侧通行带行驶。': {
    en: '20. When there are three lanes in the same direction, the rightmost lane is for overtaking and should be kept clear; slow vehicles should drive in the left lane, and fast vehicles should drive in the right lane.',
    ja: '20. 同一方向に3車線の通行帯がある場合、最右側は追い越し用通行帯で、空けておくべきです。速度の遅い車は左側通行帯を走行し、速度の速い車は右側通行帯を走行します。'
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

