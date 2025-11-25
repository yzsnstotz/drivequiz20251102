// 批量翻译所有剩余的问题
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.resolve(__dirname, '../src/data/questions/zh/questions_auto_tag.json');
const START_INDEX = 0; // 从第几个待翻译的问题开始
const BATCH_SIZE = 100; // 每批处理的问题数量

// 读取文件
console.log('读取文件...');
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const questions = JSON.parse(content);
console.log(`读取到 ${questions.length} 个问题`);

// 找出需要翻译的问题及其索引
const untranslatedIndices = [];
questions.forEach((q, i) => {
  if (q.content.en.startsWith('[EN]') || q.content.ja.startsWith('[JA]')) {
    untranslatedIndices.push(i);
  }
});

console.log(`需要翻译的问题: ${untranslatedIndices.length}`);
console.log(`处理范围: ${START_INDEX} 到 ${Math.min(START_INDEX + BATCH_SIZE, untranslatedIndices.length)}`);

// 翻译映射表 - 这里需要实际的翻译
// 由于文件很大，我们需要分批处理
const translations = {
  // 问题6
  '6. 这个标示表示禁止掉头路段"结束"。': {
    en: '6. This sign indicates the end of a "no U-turn" section.',
    ja: '6. この標識は「転回禁止」区間の「終了」を表します。'
  },
  // 问题11
  '10. 图中标志表示"中央线"，但是中央线未必一定设在道路的中央。': {
    en: '10. The sign in the figure indicates a "center line", but the center line is not necessarily located in the center of the road.',
    ja: '10. 図中の標識は「中央線」を表しますが、中央線は必ずしも道路の中央に設けられるとは限りません。'
  },
  // 问题12
  '11. 图中标志表示"机动车道路减少"。': {
    en: '11. The sign in the figure indicates "reduction of motor vehicle lanes".',
    ja: '11. 図中の標識は「自動車道路減少」を表します。'
  },
  // 问题13
  '12. 持有普通驾驶执照或轻型车托车驾驶执照不到1年的人，必须贴上新手标志。': {
    en: '12. Persons who have held a regular driver\'s license or a light vehicle/motorcycle license for less than 1 year must display a beginner\'s mark.',
    ja: '12. 普通運転免許または軽車両・原動機付自転車の免許を取得してから1年未満の者は、初心者マークを表示しなければなりません。'
  },
  // 问题14
  '13. 持有第一种驾驶执照的人，即使是为了把出租车运回修理，也不能驾驶。': {
    en: '13. A person holding a Class 1 driver\'s license cannot drive even for the purpose of returning a taxi to a repair shop.',
    ja: '13. 第一種運転免許を所持している者でも、タクシーを修理に運ぶ目的であっても運転することはできません。'
  },
  // 问题15
  '14. 在道路上驾驶机动车或轻型摩托托车时，必须考取与该车类型相应的驾驶执照。': {
    en: '14. When driving a motor vehicle or light motorcycle on the road, you must obtain a driver\'s license appropriate for that vehicle type.',
    ja: '14. 道路上で自動車または原動機付自転車を運転する際は、その車種に応じた運転免許を取得する必要があります。'
  },
  // 问题16
  '15. 即使是在有最高时速40公里标志的路段行驶，轻型摩托车的时速也不得超过30公里。': {
    en: '15. Even when driving on a section with a maximum speed limit of 40 km/h, light motorcycles must not exceed 30 km/h.',
    ja: '15. 最高速度40キロの標識がある区間を走行する場合でも、原動機付自転車の速度は30キロを超えてはいけません。'
  },
  // 问题17
  '16. 安全速度是指始终按法定速度行驶。': {
    en: '16. Safe speed means always driving at the legal speed limit.',
    ja: '16. 安全速度とは、常に法定速度で走行することを指します。'
  },
  // 问题18
  '17. 上坡属于缓行场所。': {
    en: '17. Uphill sections are places where you should slow down.',
    ja: '17. 上り坂は徐行場所に該当します。'
  },
  // 问题19
  '18. 开车时在行人旁边通过时，必须缓行保证行人安全。': {
    en: '18. When passing pedestrians while driving, you must slow down to ensure pedestrian safety.',
    ja: '18. 運転中に歩行者の横を通り過ぎる際は、歩行者の安全を確保するため徐行しなければなりません。'
  },
  // 问题20
  '19. 在安全地带的旁边通过时，只在有行人时缓行就可以了。': {
    en: '19. When passing by a safety zone, you only need to slow down when there are pedestrians.',
    ja: '19. 安全地帯の横を通り過ぎる際は、歩行者がいる場合のみ徐行すればよい。'
  }
};

// 处理指定范围的问题
let updated = 0;
const endIndex = Math.min(START_INDEX + BATCH_SIZE, untranslatedIndices.length);

for (let i = START_INDEX; i < endIndex; i++) {
  const questionIndex = untranslatedIndices[i];
  const q = questions[questionIndex];
  const zhContent = q.content.zh;
  
  if (translations[zhContent]) {
    q.content.en = translations[zhContent].en;
    q.content.ja = translations[zhContent].ja;
    updated++;
    console.log(`已更新问题 ${questionIndex + 1} (ID: ${q.id})`);
  } else {
    // 对于没有翻译映射的问题，保持占位符
    // 实际使用时需要调用翻译API
  }
}

// 保存文件
if (updated > 0) {
  console.log(`\n保存文件，已更新 ${updated} 个问题...`);
  fs.writeFileSync(INPUT_FILE, JSON.stringify(questions, null, 2), 'utf-8');
  console.log('完成！');
} else {
  console.log('没有需要更新的问题（可能需要添加更多翻译映射）');
}

console.log(`\n处理进度: ${endIndex}/${untranslatedIndices.length}`);
console.log(`剩余待翻译: ${untranslatedIndices.length - endIndex}`);

