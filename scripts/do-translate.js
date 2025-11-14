// 实际翻译并更新文件
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');

// 翻译映射表 - 前20个问题的翻译
// 这里使用实际的翻译，实际使用时应该调用翻译API
const translations = {
  // 问题1
  '1. 开车的时候，不能只考虑自己方便，要照顾到其他车辆和行人，要相互礼让驾驶。': {
    en: '1. When driving, you should not only consider your own convenience, but also take care of other vehicles and pedestrians, and drive with mutual courtesy.',
    ja: '1. 運転する際は、自分の都合だけを考えるのではなく、他の車両や歩行者に配慮し、相互に譲り合って運転する必要があります。'
  },
  // 问题2
  '2. 在有信号灯的交叉路想在右转弯的时候，因对面是绿灯进入了交叉路，但右转弯方向的信号是红灯时，此时在交叉路中停下来了。': {
    en: '2. When you want to make a right turn at an intersection with traffic lights, you entered the intersection because the opposite signal was green, but the signal in the right turn direction was red, and you stopped in the intersection.',
    ja: '2. 信号機のある交差点で右折しようとした際、対向が青信号で交差点に入ったが、右折方向の信号が赤信号だったため、交差点内で停車した。'
  },
  // 问题3
  '3. 在前方的信号灯变为黄灯的时候，已接近停止位置如果不紧急刹车不能停下来的时候，可以直接进入。': {
    en: '3. When the traffic light ahead turns yellow, if you are close to the stop position and cannot stop without emergency braking, you may proceed directly.',
    ja: '3. 前方の信号機が黄色に変わったとき、停止位置に近づいており、緊急ブレーキをかけなければ止まれない場合は、そのまま進入してもよい。'
  },
  // 问题4
  '4. 在有信号灯的交叉路，没有停止线的停止位置，是停在信号灯的跟前。': {
    en: '4. At an intersection with traffic lights, if there is no stop line, the stopping position is directly in front of the traffic light.',
    ja: '4. 信号機のある交差点で、停止線がない場合の停止位置は、信号機の直前である。'
  },
  // 问题5
  '5. 图中警察的手势信号表示：对于面对警察的车辆来说，遇到黄灯信号灯意义相同。': {
    en: '5. The police officer\'s hand signal in the figure means: For vehicles facing the police officer, it has the same meaning as a yellow traffic light.',
    ja: '5. 図中の警察官の手信号は、警察官に向かう車両にとって、黄色信号と同じ意味を表します。'
  },
  // 问题6
  '6. 这个标示表示禁止掉头路段"结束"。': {
    en: '6. This sign indicates the end of a "no U-turn" section.',
    ja: '6. この標識は「転回禁止」区間の「終了」を表します。'
  },
  // 问题7
  '7. 在有下图中标示的急转弯，可以超出右侧车线，但是必须注意对面驶来的车辆。': {
    en: '7. At sharp curves marked in the figure below, you may cross the right lane line, but you must be careful of oncoming vehicles.',
    ja: '7. 下図に示す急カーブでは、右側の車線をはみ出してもよいが、対向車に注意する必要がある。'
  },
  // 问题8
  '7. 图中标志是禁止泊车的标志。': {
    en: '7. The sign in the figure is a "no parking" sign.',
    ja: '7. 図中の標識は「駐車禁止」の標識です。'
  },
  // 问题9
  '8. 图中标志表示前方是道路的尽头。': {
    en: '8. The sign in the figure indicates that the road ends ahead.',
    ja: '8. 図中の標識は、前方が道路の終端であることを示しています。'
  },
  // 问题10
  '9. 图中标志表示前方左转弯。': {
    en: '9. The sign in the figure indicates a left turn ahead.',
    ja: '9. 図中の標識は、前方左折を表しています。'
  }
};

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 处理前20个问题
let updated = 0;
for (let i = 0; i < Math.min(20, questions.length); i++) {
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

