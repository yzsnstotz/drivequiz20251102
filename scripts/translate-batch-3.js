// 继续批量翻译更多问题
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
  // 问题54
  '4、 图中的交叉路,属于 A 车一侧和 B 车一侧的视线都较差的交叉路,因此 A 和 B 车都必须缓行....': {
    en: '4. The intersection shown in the figure is one where visibility is poor on both the A vehicle side and the B vehicle side, so both vehicles A and B must proceed slowly.',
    ja: '4. 図中の交差点は、A車側とB車側の両方で視界が悪い交差点であるため、A車とB車の両方が徐行しなければなりません。'
  },
  // 问题55
  '5、 图示禁止车辆进入，车辆可以从标志的对面(背面)进入,但是不得从正面通行...': {
    en: '5. The figure shows that vehicle entry is prohibited; vehicles may enter from the opposite side (back) of the sign, but must not pass from the front.',
    ja: '5. 図示は車両進入禁止を示しており、車両は標識の反対側（背面）から進入することはできますが、正面から通行してはいけません。'
  },
  // 问题57
  '7、 自动车的乘坐定员时，12 岁未满的孩子 2 人可以算作大人 1 人....': {
    en: '7. For the passenger capacity of motor vehicles, 2 children under 12 years old can be counted as 1 adult.',
    ja: '7. 自動車の乗車定員では、12歳未満の子供2人を大人1人として計算できます。'
  },
  // 问题59
  '9、 持有普通驾驶执照的人,除可以驾驶普通机动车以外，还可以驾驶小型的特殊机动车和轻型摩托车....': {
    en: '9. Persons holding a regular driver\'s license may drive not only regular motor vehicles, but also small special motor vehicles and light motorcycles.',
    ja: '9. 普通運転免許を所持している者は、普通自動車を運転できるほか、小型特殊自動車や原動機付自転車も運転できます。'
  },
  // 问题63
  '13、 停在道路左侧的车辆起步时的信号,可以按与向右改变车道时相同的要领发出....': {
    en: '13. The signal when starting a vehicle parked on the left side of the road can be given in the same way as when changing lanes to the right.',
    ja: '13. 道路左側に停車している車両の発進時の信号は、右側に車線変更する場合と同じ要領で出すことができます。'
  },
  // 问题66
  '16、 进行摩托车的刹车操作时，不要打方向盘,使车体保持笔,同时使用前后轮制动器....': {
    en: '16. When braking a motorcycle, do not turn the handlebars, keep the vehicle body straight, and use both front and rear wheel brakes simultaneously.',
    ja: '16. オートバイのブレーキ操作を行う際は、ハンドルを切らず、車体をまっすぐに保ち、前後輪のブレーキを同時に使用します。'
  },
  // 问题71
  '21、 右转弯时 要在交叉路跟前靠道路中央行驶...': {
    en: '21. When making a right turn, you should drive near the center of the road before the intersection.',
    ja: '21. 右折する際は、交差点の手前で道路の中央に寄って走行する必要があります。'
  },
  // 问题77
  '27、 用吊车吊起故障车的前轮或后轮牵引时，不需要驾驶员坐在故障车里....': {
    en: '27. When towing a disabled vehicle by lifting its front or rear wheels with a crane, the driver does not need to be in the disabled vehicle.',
    ja: '27. クレーンで故障車の前輪または後輪を吊り上げて牽引する際は、故障車に運転者が乗っている必要はありません。'
  },
  // 问题78
  '28、 任何情况都不能在高速上停车...': {
    en: '28. Under no circumstances should you stop on the highway.',
    ja: '28. いかなる場合でも高速道路上で停車してはいけません。'
  },
  // 问题79
  '29、 驾驶员应尊重行人与其他驾驶员的立场,本着相互礼让的原则通行....': {
    en: '29. Drivers should respect the position of pedestrians and other drivers, and proceed based on the principle of mutual courtesy.',
    ja: '29. 運転者は歩行者や他の運転者の立場を尊重し、相互に譲り合う原則に基づいて通行すべきです。'
  },
  // 问题81
  '31、 踩刹车的时候，感觉到比较松弛的时候，说明刹车很起作用...': {
    en: '31. When stepping on the brake, if it feels relatively loose, it means the brake is working well.',
    ja: '31. ブレーキを踏む際、比較的緩いと感じる場合は、ブレーキがよく効いていることを示しています。'
  },
  // 问题83
  '33、 高速道路中微型汽车、轻型摩托车发动机的总排气量在 125cc 以下的车辆禁止通行...': {
    en: '33. On highways, vehicles with micro cars and light motorcycles with a total engine displacement of 125cc or less are prohibited.',
    ja: '33. 高速道路では、総排気量125cc以下のミニカー、原動機付自転車は通行禁止です。'
  },
  // 问题85
  '35、 车辆在有行人在旁边通过时，必须缓行保证行人安全...': {
    en: '35. When vehicles have pedestrians passing nearby, they must slow down to ensure pedestrian safety.',
    ja: '35. 車両は歩行者が横を通り過ぎる際、歩行者の安全を確保するため徐行しなければなりません。'
  },
  // 问题86
  '36、 安全地带的左侧和它前后 10 米以内的场所虽然不能停,自车，但是可以临时停车...': {
    en: '36. Although you cannot park on the left side of a safety zone and within 10 meters before and after it, you may stop temporarily.',
    ja: '36. 安全地帯の左側とその前後10メートル以内の場所では駐車はできませんが、一時停止は可能です。'
  },
  // 问题95
  '45、 在高速公路上准备从加速车道驶入干线车道时,必须注意后方驶来的车辆,而不是在干线车道上行驶的前方车辆...': {
    en: '45. When preparing to enter the main lane from the acceleration lane on a highway, you must pay attention to vehicles approaching from behind, not vehicles ahead traveling on the main lane.',
    ja: '45. 高速道路で加速車線から本線車道に入る準備をする際は、本線車道を走行している前方車両ではなく、後方から来る車両に注意する必要があります。'
  },
  // 问题98
  '2. 该标志指不仅是车辆，有轨电车和行人等都禁止通行。': {
    en: '2. This sign indicates that not only vehicles, but also streetcars and pedestrians are prohibited from passing.',
    ja: '2. この標識は、車両だけでなく、路面電車や歩行者なども通行禁止であることを示しています。'
  },
  // 问题99
  '3. 在交叉路附近通行时，因为紧急车辆接近，所以靠左侧放慢了速度。': {
    en: '3. When passing near an intersection, because an emergency vehicle is approaching, slow down and move to the left.',
    ja: '3. 交差点付近を通行する際、緊急車両が接近しているため、左側に寄せて速度を落としました。'
  },
  // 问题100
  '4. 刹车时，一开始就要尽量用力踩下去为好。': {
    en: '4. When braking, it is best to step on the brake as hard as possible from the start.',
    ja: '4. ブレーキをかける際は、最初からできるだけ強く踏み込むのが良いです。'
  },
  // 问题101
  '5. 准备掉头或向右转弯时，必须在到达距其行为开始的地点的30米之前的地点时发出信号。': {
    en: '5. When preparing to make a U-turn or right turn, you must signal when you reach a point 30 meters before the location where the maneuver begins.',
    ja: '5. 転回または右折の準備をする際は、その行為を開始する地点から30メートル手前の地点に到達した際に信号を出さなければなりません。'
  },
  // 问题102
  '6. 取得第一种普通驾驶执照的人，即便是为了将出租车送回修理工场，也不可以驾驶。': {
    en: '6. A person who has obtained a Class 1 regular driver\'s license cannot drive even for the purpose of returning a taxi to a repair shop.',
    ja: '6. 第一種普通運転免許を取得した者でも、タクシーを修理工場に送り返す目的であっても運転することはできません。'
  },
  // 问题103
  '7. 驾驶执照的条款栏上所记载的「眼镜等」含使用隐形眼镜。': {
    en: '7. The "glasses, etc." noted in the conditions column of a driver\'s license includes the use of contact lenses.',
    ja: '7. 運転免許の条件欄に記載されている「眼鏡等」には、コンタクトレンズの使用も含まれます。'
  },
  // 问题104
  '8. 该标示表示禁止进入其内停车。': {
    en: '8. This sign indicates that parking inside is prohibited.',
    ja: '8. この標識は、その中への駐車が禁止されていることを示しています。'
  },
  // 问题105
  '9. 由于交叉路及其附近是交通事故的多发场所，因此应该提速迅速地通过。': {
    en: '9. Since intersections and their vicinity are places where traffic accidents frequently occur, you should speed up and pass quickly.',
    ja: '9. 交差点とその付近は交通事故の多発場所であるため、速度を上げて迅速に通過すべきです。'
  },
  // 问题106
  '10. 只要取得普通驾驶执照，就可以驾驶最大载重量为4,000kg的货车和乘车定员为11大的乘用汽车。': {
    en: '10. With a regular driver\'s license, you can drive trucks with a maximum load capacity of 4,000kg and passenger cars with a seating capacity of 11 people.',
    ja: '10. 普通運転免許を取得すれば、最大積載重量4,000kgの貨物自動車と乗車定員11人の乗用自動車を運転できます。'
  },
  // 问题107
  '11. 因为前方车辆发出了右转弯信号准备向右侧改变车道，所以鸣笛提醒其注意后，从右侧超了过去。': {
    en: '11. Because the vehicle ahead signaled a right turn and prepared to change lanes to the right, I honked to alert it and then passed it on the right.',
    ja: '11. 前方車両が右折の信号を出して右側に車線変更する準備をしたため、クラクションで注意を促した後、右側から追い越しました。'
  },
  // 问题108
  '12. 驾驶员不仅需要掌握驾驶技术及知识，作为社会一员，对其他的道路利用者还需要有体谅的心态。': {
    en: '12. Drivers need not only driving skills and knowledge, but also, as members of society, a considerate attitude toward other road users.',
    ja: '12. 運転者は運転技術や知識を身につけるだけでなく、社会の一員として、他の道路利用者に対して思いやりの心を持つ必要があります。'
  },
  // 问题109
  '13. 该标志表示车辆可以直行及左转弯，但不能右转弯。': {
    en: '13. This sign indicates that vehicles may proceed straight and turn left, but cannot turn right.',
    ja: '13. この標識は、車両は直進および左折は可能だが、右折はできないことを示しています。'
  },
  // 问题110
  '14. 车辆不能在轨道线内通行，但右转弯、左转弯、横过、掉头等时可以在轨道线内横过。': {
    en: '14. Vehicles cannot travel within the track lines, but may cross the track lines when making right turns, left turns, crossing, or U-turns.',
    ja: '14. 車両は軌道線内を通行することはできませんが、右折、左折、横断、転回などの際は軌道線内を横断することができます。'
  },
  // 问题111
  '15. 驾驶员感觉到危险踩刹车时，从制动开始起作用到车辆停止的距离称为停车距离。': {
    en: '15. When a driver senses danger and applies the brake, the distance from when the brake begins to take effect until the vehicle stops is called the stopping distance.',
    ja: '15. 運転者が危険を感じてブレーキを踏んだ際、制動が効き始めてから車両が停止するまでの距離を停止距離といいます。'
  },
  // 问题112
  '16. 在后方视野不好的场所或从狭窄的道路驶到宽阔道路等不得已倒车起动时，最好让同乘者帮助确认后方。': {
    en: '16. When reversing to start in places with poor rear visibility or when moving from a narrow road to a wide road, it is best to have a passenger help confirm the rear.',
    ja: '16. 後方視界が悪い場所や狭い道路から広い道路へ出る際など、やむを得ず後退して発進する際は、同乗者に後方を確認してもらうのが良いです。'
  },
  // 问题113
  '17. 在有障碍物的场所错车时，向有障碍物方向行驶的车辆可以优先通行。': {
    en: '17. When passing each other at places with obstacles, vehicles traveling toward the obstacle have the right of way.',
    ja: '17. 障害物がある場所で行き違いをする際、障害物方向に進む車両が優先通行できます。'
  },
  // 问题114
  '18. 由于气温下降，如果在家前面的道路上泼水的话有可能使道路结冰，但为了防止起灰泼了水。': {
    en: '18. Due to the drop in temperature, if water is splashed on the road in front of the house, it may freeze, but water was splashed to prevent dust.',
    ja: '18. 気温が下がるため、家の前の道路に水をまくと道路が凍結する可能性があるが、ほこりを防ぐために水をまいた。'
  },
  // 问题115
  '19. 在有该标志的地方，因为有交叉路，所以必须鸣笛通行。': {
    en: '19. At places with this sign, because there is an intersection, you must sound the horn when passing.',
    ja: '19. この標識がある場所では、交差点があるため、クラクションを鳴らして通行しなければなりません。'
  },
  // 问题116
  '20. 在单行路上给紧急车辆让路时，有时要靠向道路的右侧。': {
    en: '20. When giving way to emergency vehicles on a one-way street, sometimes you must move to the right side of the road.',
    ja: '20. 一方通行の道路で緊急車両に道を譲る際、道路の右側に寄る場合があります。'
  },
  // 问题117
  '21. 即使是在没有交通指示而且视野不好的交叉路，只要没有其它车辆就可以不用缓行通过。': {
    en: '21. Even at intersections without traffic signals and with poor visibility, as long as there are no other vehicles, you can pass without slowing down.',
    ja: '21. 交通指示がなく視界が悪い交差点でも、他の車両がいなければ、徐行せずに通過できます。'
  },
  // 问题118
  '22. 过度地鸣笛不仅产生噪音还刺激对方的情绪，是引起麻烦的原因。': {
    en: '22. Excessive honking not only creates noise but also irritates others, causing trouble.',
    ja: '22. 過度なクラクションは騒音を発生させるだけでなく、相手の感情を刺激し、トラブルの原因となります。'
  },
  // 问题119
  '23. 取得临时驾驶执照的人如果在汽车所规定的位置上贴上临时驾驶执照练习标记，就可以为了练习而一个人驾驶。': {
    en: '23. A person who has obtained a provisional driver\'s license can drive alone for practice if they attach a provisional license practice mark to the designated position on the vehicle.',
    ja: '23. 仮運転免許を取得した者は、自動車の規定位置に仮運転免許練習標識を貼付すれば、練習のために一人で運転できます。'
  },
  // 问题120
  '24. 面对该信号的车辆及有轨电车，不能越过停车位置前行。': {
    en: '24. Vehicles and streetcars facing this signal cannot proceed beyond the stopping position.',
    ja: '24. この信号に面する車両および路面電車は、停止位置を越えて進行することはできません。'
  },
  // 问题121
  '25. 原则上，车辆应该在道路中心（有中心线时，为中心线）以左的部分通行。': {
    en: '25. In principle, vehicles should travel on the left side of the road center (or the center line if there is one).',
    ja: '25. 原則として、車両は道路の中央（中央線がある場合は中央線）より左の部分を通行すべきです。'
  },
  // 问题122
  '26. 通过自行车的侧面在交叉路左转弯时，因为有将自行车卷入的危险，所以鸣笛提醒自行车注意后先向左转弯了。': {
    en: '26. When making a left turn at an intersection by passing the side of a bicycle, because there is a risk of involving the bicycle, I honked to alert the bicycle and then turned left first.',
    ja: '26. 自転車の横を通って交差点で左折する際、自転車を巻き込む危険があるため、クラクションで自転車に注意を促した後、先に左折しました。'
  },
  // 问题123
  '27. 在牵着导盲犬步行的人旁边通过时，必须暂时停车或缓行。': {
    en: '27. When passing a person walking with a guide dog, you must stop temporarily or slow down.',
    ja: '27. 盲導犬を連れた歩行者の横を通り過ぎる際は、一時停止または徐行しなければなりません。'
  },
  // 问题124
  '28. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '28. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '28. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题125
  '29. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '29. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '29. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题126
  '30. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '30. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '30. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题127
  '31. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '31. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '31. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题128
  '32. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '32. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '32. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
  },
  // 问题129
  '33. 取得中型驾驶执照的人可以驾驶乘车定员为30人的巴士。': {
    en: '33. A person who has obtained a medium-sized vehicle license can drive a bus with a seating capacity of 30 people.',
    ja: '33. 中型免許を取得した者は、乗車定員30人のバスを運転できます。'
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

