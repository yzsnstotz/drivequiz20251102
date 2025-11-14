// 继续批量翻译更多问题 - 第五批
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
  // 问题150
  '4. 在交叉路左右转弯时的内轮差，车越大内轮差也越大，因此必须注意驾驶。': {
    en: '4. The inner wheel difference when turning left or right at intersections increases with larger vehicles, so you must drive carefully.',
    ja: '4. 交差点で左右に曲がる際の内輪差は、車が大きいほど内輪差も大きくなるため、運転に注意が必要です。'
  },
  // 问题151
  '5. 在人行横道、自行车横道及其近前30米以内的场所，不得超越或直行超越其它车辆（轻型车辆除外）。': {
    en: '5. At crosswalks, bicycle crossings, and within 30 meters before them, you must not overtake or pass other vehicles (except light vehicles).',
    ja: '5. 横断歩道、自転車横断帯およびその手前30メートル以内の場所では、他の車両（軽車両を除く）を追い越したり追い抜いたりしてはいけません。'
  },
  // 问题152
  '6. 在根据标志禁止超车的地方，也禁止普通汽车超越轻型摩托车。': {
    en: '6. At places where overtaking is prohibited by signs, regular cars are also prohibited from overtaking light motorcycles.',
    ja: '6. 標識により追い越しが禁止されている場所では、普通自動車も原動機付自転車を追い越すことは禁止されています。'
  },
  // 问题153
  '7. 交通量少时，因为不会给其他行人或车辆带来麻烦，所以可以随意驾驶。': {
    en: '7. When traffic volume is low, because it will not cause trouble to other pedestrians or vehicles, you can drive freely.',
    ja: '7. 交通量が少ない時は、他の歩行者や車両に迷惑をかけないため、自由に運転できます。'
  },
  // 问题154
  '8. 该标志表示是公共汽车等优先通行带，当公共汽车接近时，其它汽车必须立即驶出该通行带。': {
    en: '8. This sign indicates a priority lane for buses and other vehicles; when a bus approaches, other vehicles must immediately exit this lane.',
    ja: '8. この標識はバス等優先通行帯を表し、バスが接近した際は、他の自動車は直ちにその通行帯から出なければなりません。'
  },
  // 问题155
  '9. 带有残疾人标记的行动不自由的驾驶员驾驶汽车时，不得贴近其车辆的侧面或强行加塞到其前方。': {
    en: '9. When a driver with a disability mark who has limited mobility is driving, you must not approach the side of their vehicle or force your way in front of them.',
    ja: '9. 身体障害者マークを付けた身体の不自由な運転者が自動車を運転している際は、その車両の側面に近づいたり、無理に前に割り込んだりしてはいけません。'
  },
  // 问题156
  '10. 汽车在铁路道停滞不动时，如果没有发烟筒或发烟筒已用完，最好在附近点燃容易发烟的物品发出信号。': {
    en: '10. When a vehicle is stalled on a railway crossing, if there is no flare or the flare has been used up, it is best to light items nearby that produce smoke easily to signal.',
    ja: '10. 自動車が踏切で停滞した際、発煙筒がないか発煙筒を使い切った場合は、近くで煙が出やすい物品に火をつけて信号を出すのが良いです。'
  },
  // 问题157
  '11. 取得驾驶执照的人在没有携带驾驶执照的情况下驾驶汽车时属于交通违章。': {
    en: '11. A person who has obtained a driver\'s license commits a traffic violation when driving a vehicle without carrying the driver\'s license.',
    ja: '11. 運転免許を取得した者が運転免許証を携帯せずに自動車を運転する場合は交通違反となります。'
  },
  // 问题158
  '12. 在驾驶途中使用手机会分散对周围交通状况的注意力，较为危险。': {
    en: '12. Using a mobile phone while driving distracts attention from surrounding traffic conditions and is dangerous.',
    ja: '12. 運転中に携帯電話を使用すると、周囲の交通状況への注意力が散漫になり、危険です。'
  },
  // 问题159
  '13. 所谓标示，是指用涂料或路钉等在路面上标划的线段、符号和文字，分为限制标示和指示标示两种。': {
    en: '13. Markings refer to lines, symbols, and text marked on the road surface using paint or road studs, and are divided into two types: regulatory markings and guide markings.',
    ja: '13. 標示とは、塗料や道路鋲などで路面に標示された線分、記号、文字のことで、規制標示と指示標示の2種類に分けられます。'
  },
  // 问题160
  '14. 在交叉路准备右转弯时，虽然对面方向有二轮摩托车直行过来，但因为自己的车辆有优先权，所以可以先向右转弯。': {
    en: '14. When preparing to turn right at an intersection, even though a two-wheeled motorcycle is coming straight from the opposite direction, because your vehicle has the right of way, you can turn right first.',
    ja: '14. 交差点で右折の準備をする際、対向方向から二輪自動車が直進してきても、自分の車両に優先権があるため、先に右折できます。'
  },
  // 问题161
  '15. 在人行横道近前，即使明显没有横过的行人也必须减速至在人行横道近前可以停车的速度行驶。': {
    en: '15. Before a crosswalk, even if there are clearly no pedestrians crossing, you must slow down to a speed at which you can stop before the crosswalk.',
    ja: '15. 横断歩道の手前では、明らかに横断する歩行者がいなくても、横断歩道の手前で停止できる速度まで減速して走行しなければなりません。'
  },
  // 问题162
  '16. 前面的车辆在交叉路或铁路道等停车或缓行时，不得在其前面加塞或横穿。': {
    en: '16. When a vehicle ahead stops or slows down at an intersection or railway crossing, you must not cut in front of it or cross.',
    ja: '16. 前方の車両が交差点や踏切などで停車または徐行している際は、その前に割り込んだり横断したりしてはいけません。'
  },
  // 问题163
  '17. 禁止在上坡的坡顶附近及陡下坡超越汽车及轻型摩托车。': {
    en: '17. Overtaking cars and light motorcycles is prohibited near the top of uphill slopes and on steep downhill slopes.',
    ja: '17. 上り坂の頂上付近および急な下り坂では、自動車や原動機付自転車を追い越すことは禁止されています。'
  },
  // 问题164
  '18. 红灯闪烁时，面对该信号的车辆及有轨电车，要在停车位置暂时停车，确认安全后可以前行。': {
    en: '18. When the red light is flashing, vehicles and streetcars facing this signal must stop temporarily at the stopping position, and may proceed after confirming safety.',
    ja: '18. 赤色点滅時、この信号に面する車両および路面電車は、停止位置で一時停止し、安全を確認した後進行できます。'
  },
  // 问题165
  '19. 无论道路状况或其它交通状况如何，都禁止越入道路中心以右的部分通行。': {
    en: '19. Regardless of road conditions or other traffic conditions, it is prohibited to cross into the right side of the road center to travel.',
    ja: '19. 道路状況やその他の交通状況に関係なく、道路の中央より右の部分に越入して通行することは禁止されています。'
  },
  // 问题166
  '20. 根据标志要暂时停车的交叉路是容易发生交通事故的危险场所，因此必须暂时停车确认安全后再通行。': {
    en: '20. Intersections where you must stop temporarily according to signs are dangerous places where traffic accidents are likely to occur, so you must stop temporarily and confirm safety before proceeding.',
    ja: '20. 標識により一時停止が必要な交差点は交通事故が発生しやすい危険な場所であるため、一時停止して安全を確認した後通行しなければなりません。'
  },
  // 问题167
  '21. 在停止着的幼儿园、学校班车旁边通过时，必须暂时停车确认安全。': {
    en: '21. When passing a stopped kindergarten or school bus, you must stop temporarily and confirm safety.',
    ja: '21. 停車している幼稚園・学校のスクールバスの横を通り過ぎる際は、一時停止して安全を確認しなければなりません。'
  },
  // 问题168
  '22. 所谓超车，是指改变车道驶到前面正在行驶的车辆的前方，因为驾驶操作复杂，所以尽量不要超车，以安全的速度行驶。': {
    en: '22. Overtaking refers to changing lanes to move ahead of a vehicle traveling in front; because the driving operation is complex, try to avoid overtaking and drive at a safe speed.',
    ja: '22. 追い越しとは、車線を変更して前方を走行している車両の前に出ることで、運転操作が複雑なため、できるだけ追い越しを避け、安全な速度で走行します。'
  },
  // 问题169
  '23. 儿童安全椅在生病等不得已的情况下可以不使用。': {
    en: '23. Child safety seats may not be used in unavoidable circumstances such as illness.',
    ja: '23. チャイルドシートは、病気などのやむを得ない場合には使用しなくてもよいです。'
  },
  // 问题170
  '24. 该标志表示是道路的中心或中心线。': {
    en: '24. This sign indicates the center of the road or the center line.',
    ja: '24. この標識は道路の中央または中央線を表しています。'
  },
  // 问题171
  '25. 在交叉路内，发现从后方有紧急车辆接近时，必须立即原地停车。': {
    en: '25. Within an intersection, when you notice an emergency vehicle approaching from behind, you must stop immediately where you are.',
    ja: '25. 交差点内で、後方から緊急車両が接近していることに気づいた際は、直ちにその場で停止しなければなりません。'
  },
  // 问题172
  '26. 因为前方的信号从黄色变成了红色，所以为提醒后面驶来的车辆停车分数次踩了刹车。': {
    en: '26. Because the signal ahead changed from yellow to red, I stepped on the brake several times to alert vehicles approaching from behind to stop.',
    ja: '26. 前方の信号が黄色から赤色に変わったため、後方から来る車両に停止を促すため、数回ブレーキを踏みました。'
  },
  // 问题173
  '27. 左右转弯等行为结束时，收回所发出信号的时间是其行为结束的约3秒钟之后。': {
    en: '27. When turning left or right and other maneuvers end, the time to cancel the signal given is approximately 3 seconds after the maneuver ends.',
    ja: '27. 左右折などの行為が終了した際、出した信号を戻す時間は、その行為が終了してから約3秒後です。'
  },
  // 问题174
  '28. 取得普通临时驾驶执照的人，如果是为了练习，可以驾驶轻型摩托车。': {
    en: '28. A person who has obtained a regular provisional driver\'s license can drive a light motorcycle if it is for practice.',
    ja: '28. 普通仮運転免許を取得した者は、練習の目的であれば原動機付自転車を運転できます。'
  },
  // 问题175
  '29. 腰部安全带松弛地系在腹部即可。': {
    en: '29. The lap belt should be loosely fastened around the abdomen.',
    ja: '29. 腰ベルトは腹部に緩く締めればよいです。'
  },
  // 问题176
  '30. 该标志是表示注意危险的警告标志。': {
    en: '30. This sign is a warning sign indicating danger to be aware of.',
    ja: '30. この標識は危険に注意することを示す警告標識です。'
  },
  // 问题177
  '31. 在设有公共汽车等优先通行带的道路上，为了向左转弯通过了该车辆通行带。': {
    en: '31. On a road with a priority lane for buses and other vehicles, I passed through that lane in order to turn left.',
    ja: '31. バス等優先通行帯が設けられている道路で、左折するためにその通行帯を通過しました。'
  },
  // 问题178
  '32. 汽车驾驶员在有行人的安全地带旁边通过时必须缓行。': {
    en: '32. Vehicle drivers must slow down when passing near a safety zone with pedestrians.',
    ja: '32. 自動車の運転者は、歩行者のいる安全地帯の横を通り過ぎる際は徐行しなければなりません。'
  },
  // 问题179
  '33. 驾驶汽车时不得随意改变车道，但在不得已的情况下改变车道时，需要利用后视镜或通过目视来确认安全。': {
    en: '33. You must not change lanes arbitrarily when driving, but when changing lanes in unavoidable circumstances, you need to use the rearview mirror or visually confirm safety.',
    ja: '33. 自動車を運転する際は、随意に車線を変更してはいけませんが、やむを得ない場合に車線を変更する際は、バックミラーを利用するか、目視で安全を確認する必要があります。'
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

