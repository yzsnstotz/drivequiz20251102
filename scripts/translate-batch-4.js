// 继续批量翻译更多问题 - 第四批
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
  // 问题130
  '34. 驾驶座席靠背的位置应调整到双手握方向盘时，肘部微曲的状态相一致。': {
    en: '34. The position of the driver\'s seat backrest should be adjusted to match the state where the elbows are slightly bent when holding the steering wheel with both hands.',
    ja: '34. 運転席のシートバックの位置は、両手でハンドルを握った際に肘が軽く曲がった状態と一致するように調整すべきです。'
  },
  // 问题131
  '35. 该标志下的辅助标牌表示上述主标志的交通限制地段。': {
    en: '35. The auxiliary sign below this sign indicates the traffic restriction area of the main sign mentioned above.',
    ja: '35. この標識の下の補助標識は、上記の主標識の交通制限区間を表しています。'
  },
  // 问题132
  '36. 在道路左侧被指定为公共汽车专用通行带的地方，即使是左转弯时，也不能在该车道通行。': {
    en: '36. In places where the left side of the road is designated as a bus-only lane, you cannot travel in that lane even when making a left turn.',
    ja: '36. 道路左側がバス専用通行帯に指定されている場所では、左折する場合でもその車線を通行することはできません。'
  },
  // 问题133
  '37. 要改变车道时，因后方有车辆已接近，所以没有改变车道让了路。': {
    en: '37. When trying to change lanes, because a vehicle was approaching from behind, I did not change lanes and gave way.',
    ja: '37. 車線変更しようとした際、後方から車両が接近していたため、車線変更せずに道を譲りました。'
  },
  // 问题134
  '38. 在自动变速车使用发动机制动时，最好将变速杆切入2档或L档(或1档)。': {
    en: '38. When using engine braking in an automatic transmission vehicle, it is best to shift the gear lever to 2nd gear or L gear (or 1st gear).',
    ja: '38. オートマチック車でエンジンブレーキを使用する際は、シフトレバーを2速またはL速（または1速）に入れるのが良いです。'
  },
  // 问题135
  '39. 在行人旁边通过时必须与行人之间留出充分的间隔或缓行，但行人在路侧带时则没有必要。': {
    en: '39. When passing pedestrians, you must leave sufficient space or slow down, but this is not necessary when pedestrians are on the roadside strip.',
    ja: '39. 歩行者の横を通り過ぎる際は、歩行者との間に十分な間隔を取るか徐行する必要がありますが、歩行者が路側帯にいる場合は必要ありません。'
  },
  // 问题136
  '40. 即使前方信号灯的信号是红色，也必须听从正在指挥交通的警察的右转弯或左转弯的指示。': {
    en: '40. Even if the signal ahead is red, you must follow the instructions of the police officer directing traffic to turn right or left.',
    ja: '40. 前方の信号機の信号が赤色であっても、交通整理を行っている警察官の右折または左折の指示に従わなければなりません。'
  },
  // 问题137
  '41. 道路中心线的左侧部分正在施工不能通行时，可以越入右侧部分通行。': {
    en: '41. When the left side of the road center line is under construction and cannot be traveled, you may cross into the right side to proceed.',
    ja: '41. 道路中心線の左側部分が工事中で通行できない場合、右側部分に越入して通行することができます。'
  },
  // 问题138
  '42. 由于铁路道对面交通拥挤，若照常行驶有可能在铁路道内停滞不动时，不得进入铁路道。': {
    en: '42. Due to traffic congestion on the opposite side of the railway crossing, if proceeding normally might cause you to stop within the railway crossing, you must not enter the railway crossing.',
    ja: '42. 踏切の向こう側の交通が混雑しているため、通常通り走行すると踏切内で停滞する可能性がある場合は、踏切に入ってはいけません。'
  },
  // 问题139
  '43. 因贴有初学者标记的汽车以最高限速以下的速度行驶，所以鸣笛让对方避到道路左侧后驶了过去。': {
    en: '43. Because a car with a beginner\'s mark was traveling below the maximum speed limit, I honked to have it move to the left side of the road and then passed it.',
    ja: '43. 初心者マークを貼った自動車が最高速度以下の速度で走行していたため、クラクションで左側に避けさせた後、追い越しました。'
  },
  // 问题140
  '44. 超车时，如果急加速或急打方向盘改变车道，就有可能导致方向盘失控或发生侧滑，所以必须充分注意。': {
    en: '44. When overtaking, if you accelerate suddenly or turn the steering wheel sharply to change lanes, it may cause loss of steering control or side slipping, so you must be very careful.',
    ja: '44. 追い越しの際、急加速したり急にハンドルを切って車線変更したりすると、ハンドル操作が効かなくなったり横滑りが発生したりする可能性があるため、十分に注意する必要があります。'
  },
  // 问题141
  '45. 让儿童坐在前面的座席不仅对儿童非常危险，也影响驾驶操作。': {
    en: '45. Having children sit in the front seat is not only very dangerous for children, but also affects driving operations.',
    ja: '45. 子供を前の座席に座らせることは、子供にとって非常に危険であるだけでなく、運転操作にも影響を与えます。'
  },
  // 问题142
  '46. 该标志表示前方道路是上陡坡。': {
    en: '46. This sign indicates that the road ahead is a steep uphill slope.',
    ja: '46. この標識は、前方の道路が急な上り坂であることを示しています。'
  },
  // 问题143
  '47. 右转弯时，必须尽量提前靠近道路的中心，紧贴交叉路中心的内侧（根据标志指定有通行场所时，在其指定的场所）缓行。': {
    en: '47. When making a right turn, you must approach the center of the road as early as possible, and proceed slowly close to the inside of the intersection center (or at the designated location if specified by signs).',
    ja: '47. 右折する際は、できるだけ早く道路の中央に寄り、交差点の中央の内側（標識で通行場所が指定されている場合は、その指定された場所）に沿って徐行しなければなりません。'
  },
  // 问题144
  '48. 在为起动自动变速车而操作变速杆时，只要不松开加速踏板，就不用拉手刹或踩刹车踏板。': {
    en: '48. When operating the gear lever to start an automatic transmission vehicle, as long as you do not release the accelerator pedal, you do not need to pull the handbrake or step on the brake pedal.',
    ja: '48. オートマチック車を始動するためにシフトレバーを操作する際は、アクセルペダルを離さない限り、サイドブレーキを引いたりブレーキペダルを踏んだりする必要はありません。'
  },
  // 问题145
  '49. 因为在没有人行横道的交叉路有行人横过，为不妨碍其通行，暂时停了下来等待行人横过结束。': {
    en: '49. Because there were pedestrians crossing at an intersection without a crosswalk, I temporarily stopped to wait for them to finish crossing so as not to obstruct their passage.',
    ja: '49. 横断歩道のない交差点で歩行者が横断していたため、その通行を妨げないよう、一時停止して歩行者の横断が終わるのを待ちました。'
  },
  // 问题146
  '50. 在根据标志或标示禁止横穿或掉头的地点，即使没有行人或其它车辆也不得横穿或掉头。': {
    en: '50. At locations where crossing or U-turns are prohibited by signs or markings, you must not cross or make a U-turn even if there are no pedestrians or other vehicles.',
    ja: '50. 標識や標示により横断または転回が禁止されている場所では、歩行者や他の車両がいなくても横断または転回してはいけません。'
  },
  // 问题147
  '1. 接近交叉路前的停车位置时，前方的信号变成了黄灯，此时只有在无法安全停车的情况下才可以不停车通过交叉路。': {
    en: '1. When approaching the stopping position before an intersection, the signal ahead turned yellow; at this time, you can only proceed through the intersection without stopping if it is impossible to stop safely.',
    ja: '1. 交差点前の停止位置に接近した際、前方の信号が黄色に変わった。この場合、安全に停止することができない場合にのみ、停止せずに交差点を通過できます。'
  },
  // 问题148
  '2. 路面被雨水淋湿、轮胎磨损严重时，与干燥路面轮胎状况良好时相比，停车距离基本没有差别。': {
    en: '2. When the road surface is wet from rain and tires are severely worn, the stopping distance is basically no different compared to when the road is dry and tire conditions are good.',
    ja: '2. 路面が雨水で濡れ、タイヤの摩耗が激しい場合、乾燥した路面でタイヤの状態が良好な場合と比較して、停止距離は基本的に差がありません。'
  },
  // 问题149
  '3. 不能进入有该标示的路侧带内驻车或停车。': {
    en: '3. You cannot park or stop within the roadside strip marked with this sign.',
    ja: '3. この標示がある路側帯内に駐車または停車することはできません。'
  },
  // 问题150
  '4. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '4. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '4. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题151
  '5. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '5. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '5. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题152
  '6. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '6. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '6. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题153
  '7. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '7. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '7. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题154
  '8. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '8. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '8. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
  },
  // 问题155
  '9. 取得中型驾驶执照的人可以驾驶乘车定员为30人的巴士。': {
    en: '9. A person who has obtained a medium-sized vehicle license can drive a bus with a seating capacity of 30 people.',
    ja: '9. 中型免許を取得した者は、乗車定員30人のバスを運転できます。'
  },
  // 问题156
  '10. 在交叉路及其近前30米以内的场所，除了在优先道路通行时以外，不得为了超越其它汽车或轻型摩托车而改变车道或在其车辆旁边通过。': {
    en: '10. At intersections and within 30 meters before them, except when traveling on priority roads, you must not change lanes or pass other vehicles or light motorcycles to overtake them.',
    ja: '10. 交差点およびその手前30メートル以内の場所では、優先道路を通行している場合を除き、他の自動車や原動機付自転車を追い越すために車線変更したり、その車両の横を通り過ぎたりしてはいけません。'
  },
  // 问题157
  '11. 在有该标志的地方，无论前方信号如何都可以向左转弯。': {
    en: '11. At places with this sign, you can turn left regardless of the signal ahead.',
    ja: '11. この標識がある場所では、前方の信号に関係なく左折できます。'
  },
  // 问题158
  '12. 在同一方向有三条车辆通行带的道路上，驾驶普通汽车一直在左数第三条通行带上行驶了。': {
    en: '12. On a road with three vehicle lanes in the same direction, I drove a regular car continuously on the third lane from the left.',
    ja: '12. 同一方向に3車線の通行帯がある道路で、普通自動車を左から3番目の通行帯で走行し続けました。'
  },
  // 问题159
  '13. 普通汽车在没有用标志或标示指定的普通公路上的最高限速是时速60公里。': {
    en: '13. The maximum speed limit for regular cars on ordinary roads not specified by signs or markings is 60 kilometers per hour.',
    ja: '13. 標識や標示で指定されていない普通道路での普通自動車の最高速度は時速60キロメートルです。'
  },
  // 问题160
  '14. 上车后关车门时，为了防止车门没关紧，最好用力一下关好。': {
    en: '14. When closing the car door after getting in, to prevent the door from not being closed tightly, it is best to close it firmly with force.',
    ja: '14. 乗車後ドアを閉める際は、ドアがしっかり閉まらないのを防ぐため、力を入れてしっかり閉めるのが良いです。'
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
    
    // 如果有 explanation 字段且需要翻译
    if (q.explanation && q.explanation.zh) {
      const zhExplanation = q.explanation.zh;
      // 如果 explanation 还没有翻译，保持原样（暂时不处理）
      if (q.explanation.en && q.explanation.en.startsWith('[EN]')) {
        // 可以在这里添加 explanation 的翻译
      }
    }
    
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

