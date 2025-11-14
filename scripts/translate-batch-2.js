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
  // 问题48
  '21. 在不得已的情况下，可以在安全地带行驶。': {
    en: '21. In unavoidable circumstances, you may drive in a safety zone.',
    ja: '21. やむを得ない場合、安全地帯を走行することができます。'
  },
  // 问题49
  '22. 为进出临近道路的场所内横穿人行道和路侧带时，如果没有行人通行，不必在人行道和路侧带前暂时停车。': {
    en: '22. When crossing sidewalks and roadside strips to enter or exit places adjacent to the road, if there are no pedestrians, you do not need to stop temporarily before the sidewalk and roadside strip.',
    ja: '22. 道路に隣接する場所への出入りのため歩道や路側帯を横断する際、歩行者がいない場合は、歩道や路側帯の前で一時停止する必要はありません。'
  },
  // 问题50
  '23. 有图中标志的道路，原则禁止车辆通行，但在路旁有车库的车辆等，取得警察署的许可后，车辆可缓行通过。': {
    en: '23. Roads with the sign shown in the figure are generally prohibited for vehicle traffic, but vehicles with garages along the road, after obtaining permission from the police station, may proceed slowly.',
    ja: '23. 図中の標識がある道路は原則として車両通行禁止ですが、路傍に車庫がある車両などは、警察署の許可を得た後、車両は徐行して通過することができます。'
  },
  // 问题51
  '1、 在图中表示的地方，不越过右侧道路部分的时候可以超车': {
    en: '1. At the place shown in the figure, you may overtake without crossing the right side of the road.',
    ja: '1. 図中に示された場所では、右側道路部分を越えない場合、追い越しが可能です。'
  },
  // 问题52
  '2、 在这个标志的场所,不能停泊车或临时停车。': {
    en: '2. At places with this sign, you cannot park or stop temporarily.',
    ja: '2. この標識のある場所では、駐車や一時停止はできません。'
  },
  // 问题53
  '3、 有图中的车辆通行带的地方,可以按箭头指向改变车道': {
    en: '3. At places with vehicle lanes as shown in the figure, you may change lanes according to the arrow direction.',
    ja: '3. 図中の車両通行帯がある場所では、矢印の方向に従って車線変更することができます。'
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
  // 问题56
  '6、 落石危险': {
    en: '6. Falling rock danger',
    ja: '6. 落石危険'
  },
  // 问题57
  '7、 自动车的乘坐定员时，12 岁未满的孩子 2 人可以算作大人 1 人....': {
    en: '7. For the passenger capacity of motor vehicles, 2 children under 12 years old can be counted as 1 adult.',
    ja: '7. 自動車の乗車定員では、12歳未満の子供2人を大人1人として計算できます。'
  },
  // 问题58
  '8、 在视线较差的左弯道上,靠中央线行驶能够迅速确认弯道前方,因此很安全。': {
    en: '8. On left curves with poor visibility, driving near the center line allows quick confirmation of the road ahead, making it safer.',
    ja: '8. 視界の悪い左カーブでは、中央線に寄って走行することで、カーブ前方を迅速に確認できるため、安全です。'
  },
  // 问题59
  '9、 持有普通驾驶执照的人,除可以驾驶普通机动车以外，还可以驾驶小型的特殊机动车和轻型摩托车....': {
    en: '9. Persons holding a regular driver\'s license may drive not only regular motor vehicles, but also small special motor vehicles and light motorcycles.',
    ja: '9. 普通運転免許を所持している者は、普通自動車を運転できるほか、小型特殊自動車や原動機付自転車も運転できます。'
  },
  // 问题60
  '10、 再雪地或结冰的道路等行驶的时候,必须使用轮胎防滑链或者冬季轮胎，防备打滑或者横向打滑等。': {
    en: '10. When driving on snowy or icy roads, you must use tire chains or winter tires to prevent skidding or lateral sliding.',
    ja: '10. 雪道や凍結した道路などを走行する際は、タイヤチェーンまたは冬用タイヤを使用し、スリップや横滑りなどを防ぐ必要があります。'
  },
  // 问题61
  '11、 下雨的时候,空走距离变长,但是制动距离不变。': {
    en: '11. When it rains, the free-running distance increases, but the braking distance remains unchanged.',
    ja: '11. 雨の日は空走距離が長くなりますが、制動距離は変わりません。'
  },
  // 问题62
  '12、 以每小时 60 公里的速度猛烈撞击钢筋混凝土墙壁时,会受到和从 5 层程度建筑物落下(大约 14 米)时相同程度的冲击。': {
    en: '12. When crashing into a reinforced concrete wall at a speed of 60 kilometers per hour, you will experience the same level of impact as falling from a 5-story building (approximately 14 meters).',
    ja: '12. 時速60キロで鉄筋コンクリートの壁に激突すると、5階建て程度の建物（約14メートル）から落下した場合と同じ程度の衝撃を受けます。'
  },
  // 问题63
  '13、 停在道路左侧的车辆起步时的信号,可以按与向右改变车道时相同的要领发出....': {
    en: '13. The signal when starting a vehicle parked on the left side of the road can be given in the same way as when changing lanes to the right.',
    ja: '13. 道路左側に停車している車両の発進時の信号は、右側に車線変更する場合と同じ要領で出すことができます。'
  },
  // 问题64
  '14、 中央线不一定设置在道路中央。': {
    en: '14. The center line is not necessarily set in the center of the road.',
    ja: '14. 中央線は必ずしも道路の中央に設置されるとは限りません。'
  },
  // 问题65
  '15、 自动变速车在启动发动机的时候,在启动发动机前要脚踏刹车踏板确定位置，用眼睛确认油门踏板位置等非常重要。': {
    en: '15. When starting an automatic transmission vehicle, it is very important to step on the brake pedal to confirm the position before starting the engine, and visually confirm the position of the accelerator pedal.',
    ja: '15. オートマチック車をエンジン始動する際は、エンジン始動前にブレーキペダルを踏んで位置を確認し、アクセルペダルの位置を目視で確認することが非常に重要です。'
  },
  // 问题66
  '16、 进行摩托车的刹车操作时，不要打方向盘,使车体保持笔,同时使用前后轮制动器....': {
    en: '16. When braking a motorcycle, do not turn the handlebars, keep the vehicle body straight, and use both front and rear wheel brakes simultaneously.',
    ja: '16. オートバイのブレーキ操作を行う際は、ハンドルを切らず、車体をまっすぐに保ち、前後輪のブレーキを同時に使用します。'
  },
  // 问题67
  '17、 改变车道的时候,如果后面的车不能避免急刹车或者急打方向盘的情况下,就不能改变车道。': {
    en: '17. When changing lanes, if the vehicle behind cannot avoid sudden braking or sudden steering, you must not change lanes.',
    ja: '17. 車線変更の際、後続車が急ブレーキや急ハンドルを避けられない場合は、車線変更してはいけません。'
  },
  // 问题68
  '18、 在靠着道路左侧步行道与步行道平行停着的车辆右侧不可以停泊车，但是可以临时停车。': {
    en: '18. You cannot park on the right side of a vehicle parked parallel to the sidewalk on the left side of the road, but you may stop temporarily.',
    ja: '18. 道路左側の歩道に沿って歩道と平行に停車している車両の右側では駐車はできませんが、一時停止は可能です。'
  },
  // 问题69
  '19、 在有信号灯的交叉路想往右转弯的时候,因对面是绿灯进入了交叉路，但右转弯方向的信号是红灯的，此时在交叉路中停下来了。': {
    en: '19. When wanting to make a right turn at an intersection with traffic lights, you entered the intersection because the opposite signal was green, but the signal in the right turn direction was red, so you stopped in the intersection.',
    ja: '19. 信号機のある交差点で右折しようとした際、対向が青信号で交差点に入ったが、右折方向の信号が赤信号だったため、交差点内で停車した。'
  },
  // 问题70
  '20、 乘坐副驾驶座位的人必须使用安全带,但坐在后部座位的人不必使用。': {
    en: '20. Persons riding in the front passenger seat must use a seat belt, but those sitting in the rear seats do not need to use one.',
    ja: '20. 助手席に乗車する者はシートベルトを使用しなければなりませんが、後部座席に座る者は使用する必要はありません。'
  },
  // 问题71
  '21、 右转弯时 要在交叉路跟前靠道路中央行驶...': {
    en: '21. When making a right turn, you should drive near the center of the road before the intersection.',
    ja: '21. 右折する際は、交差点の手前で道路の中央に寄って走行する必要があります。'
  },
  // 问题72
  '22、 夜间与白天相比视野比较差,看不清行人和自行车等,会导致发现得太晚,所以行驶速度应该比白天慢。': {
    en: '22. At night, visibility is worse compared to daytime, making it difficult to see pedestrians and bicycles, which can lead to late detection, so driving speed should be slower than during the day.',
    ja: '22. 夜間は昼間と比べて視界が悪く、歩行者や自転車などが見えにくく、発見が遅れる可能性があるため、走行速度は昼間より遅くすべきです。'
  },
  // 问题73
  '23、 两人同乘大型摩托车或普通摩托车等的时候,应该尽可能选择后部位置较为宽敞的车型。': {
    en: '23. When two people ride together on a large motorcycle or regular motorcycle, you should choose a model with a more spacious rear position whenever possible.',
    ja: '23. 大型オートバイや普通オートバイなどに2人で同乗する際は、可能な限り後部位置が広い車種を選ぶべきです。'
  },
  // 问题74
  '24、 即使获得了普通摩托车驾驶执照,获得期间未满 1 年的人,在一般道路上不能带人驾驶普通摩托车。': {
    en: '24. Even if you have obtained a regular motorcycle license, persons who have held it for less than 1 year cannot carry passengers on regular motorcycles on ordinary roads.',
    ja: '24. 普通自動二輪免許を取得していても、取得期間が1年未満の者は、一般道路で普通オートバイに人を乗せて運転することはできません。'
  },
  // 问题75
  '25、 准备在高速公路上通行时,为了避免由于燃料冷却水、发动机油不足而停止.必须特意检查，': {
    en: '25. When preparing to travel on a highway, to avoid stopping due to insufficient fuel, coolant, or engine oil, you must check carefully.',
    ja: '25. 高速道路を通行する準備をする際は、燃料、冷却水、エンジンオイルの不足による停止を避けるため、念入りにチェックする必要があります。'
  },
  // 问题76
  '26、 由于车辆的重心会升高或失去平衡，容易侧翻,因此货物应当尽量装在低处，并保持左右平衡，': {
    en: '26. Since the vehicle\'s center of gravity will rise or lose balance, making it prone to rollover, cargo should be loaded as low as possible and maintain left-right balance.',
    ja: '26. 車両の重心が上がったりバランスを失ったりして横転しやすくなるため、荷物はできるだけ低い位置に積み、左右のバランスを保つ必要があります。'
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
  // 问题80
  '30、 在下坡路等场所刹车失效，并且使用了发动机制动器和手制动器等的时候,应该让车轮掉落到靠山的一侧的沟槽里，或者冲上路边的碎石地来停车，': {
    en: '30. When brakes fail on downhill roads and you have used engine brakes and hand brakes, you should let the wheels fall into the ditch on the mountain side, or run onto the roadside gravel to stop.',
    ja: '30. 下り坂などでブレーキが効かなくなり、エンジンブレーキやハンドブレーキなどを使用した場合、車輪を山側の溝に落とすか、路肩の砂利地に突っ込んで停車させるべきです。'
  },
  // 问题81
  '31、 踩刹车的时候，感觉到比较松弛的时候，说明刹车很起作用...': {
    en: '31. When stepping on the brake, if it feels relatively loose, it means the brake is working well.',
    ja: '31. ブレーキを踏む際、比較的緩いと感じる場合は、ブレーキがよく効いていることを示しています。'
  },
  // 问题82
  '32、 绿灯因为不是前进的命令,所以在交叉路，人行横道，铁路道等地方,就出不来的交通状态的时候，即使是绿灯也不能进入。': {
    en: '32. Since a green light is not a command to proceed, at intersections, crosswalks, railway crossings, and other places where traffic cannot exit, you must not enter even if the light is green.',
    ja: '32. 青信号は進行の命令ではないため、交差点、横断歩道、踏切など、出られない交通状態の場所では、青信号であっても進入してはいけません。'
  },
  // 问题83
  '33、 高速道路中微型汽车、轻型摩托车发动机的总排气量在 125cc 以下的车辆禁止通行...': {
    en: '33. On highways, vehicles with micro cars and light motorcycles with a total engine displacement of 125cc or less are prohibited.',
    ja: '33. 高速道路では、総排気量125cc以下のミニカー、原動機付自転車は通行禁止です。'
  },
  // 问题84
  '34、 检查证是很重要的资料,所以应该准备一份复印件放在车里备用，将原件好好保存。': {
    en: '34. The inspection certificate is an important document, so you should prepare a copy to keep in the car as a backup, and keep the original safe.',
    ja: '34. 検査証は重要な資料であるため、コピーを車内に保管しておき、原本は大切に保管すべきです。'
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
  // 问题87
  '37、 即使以同样的速度行走，也会感到夜间比白天慢。': {
    en: '37. Even when traveling at the same speed, it feels slower at night than during the day.',
    ja: '37. 同じ速度で走行しても、夜間は昼間より遅く感じられます。'
  },
  // 问题88
  '38、 行入专用道路,准许小型特殊机动车,轻型摩托车及轻型车通行，': {
    en: '38. On pedestrian-only roads, small special motor vehicles, light motorcycles, and light vehicles are permitted to pass.',
    ja: '38. 歩行者専用道路では、小型特殊自動車、原動機付自転車、軽車両の通行が許可されています。'
  },
  // 问题89
  '39、 为紧急车辆让行时,即使在单行线上，也必须将车辆靠向道路左侧，': {
    en: '39. When giving way to emergency vehicles, even on one-way streets, you must move your vehicle to the left side of the road.',
    ja: '39. 緊急車両に道を譲る際は、一方通行の道路であっても、車両を道路の左側に寄せなければなりません。'
  },
  // 问题90
  '40、 在左侧部分的路面宽度在 6 米以上的道路,视线良好并且不会影响对面驶来的车的通行时，可以从道路右侧越线超车。': {
    en: '40. On roads where the left side has a road width of 6 meters or more, when visibility is good and it will not affect oncoming traffic, you may overtake by crossing the line from the right side of the road.',
    ja: '40. 左側部分の路面幅が6メートル以上の道路では、視界が良好で対向車の通行に影響しない場合、道路右側から線を越えて追い越しが可能です。'
  },
  // 问题91
  '41、 在交叉路左转弯时,左后方有自行车快速接近,因为有可能刮到,所按喇叭抢先左转。': {
    en: '41. When making a left turn at an intersection, if a bicycle is rapidly approaching from the left rear and there is a possibility of contact, honk the horn and turn left first.',
    ja: '41. 交差点で左折する際、左後方から自転車が急速に接近しており、接触の可能性があるため、クラクションを鳴らして先に左折する。'
  },
  // 问题92
  '42、 在禁止停泊车的道路上停车并在车中等待友人 5 分钟的行为是非法停车。': {
    en: '42. Parking on a road where parking is prohibited and waiting in the car for a friend for 5 minutes is illegal parking.',
    ja: '42. 駐車禁止の道路に停車し、車内で友人を5分間待つ行為は違法駐車です。'
  },
  // 问题93
  '43、 在转弯时,与速度无关,一定会产生内轮差。': {
    en: '43. When turning, inner wheel difference will always occur regardless of speed.',
    ja: '43. 曲がる際は、速度に関係なく、必ず内輪差が発生します。'
  },
  // 问题94
  '44、 在有步行道的道路上停车的时候,为了留出更宽的车道,最好将轮胎的一部分停在步行道上。': {
    en: '44. When parking on a road with a sidewalk, to leave a wider lane, it is best to park part of the tires on the sidewalk.',
    ja: '44. 歩道のある道路に駐車する際は、より広い車線を確保するため、タイヤの一部を歩道に停めるのが最善です。'
  },
  // 问题95
  '45、 在高速公路上准备从加速车道驶入干线车道时,必须注意后方驶来的车辆,而不是在干线车道上行驶的前方车辆...': {
    en: '45. When preparing to enter the main lane from the acceleration lane on a highway, you must pay attention to vehicles approaching from behind, not vehicles ahead traveling on the main lane.',
    ja: '45. 高速道路で加速車線から本線車道に入る準備をする際は、本線車道を走行している前方車両ではなく、後方から来る車両に注意する必要があります。'
  },
  // 问题96
  '46、 前面或出入前后 3 米以内的场所,如果是自己所拥有的车库或就可以停泊车。': {
    en: '46. In places within 3 meters before or after entrances and exits, if it is your own garage, you may park.',
    ja: '46. 出入口の前後3メートル以内の場所は、自分が所有する車庫であれば駐車可能です。'
  },
  // 问题97
  '1. 由于安全带在发生交通事故时可以大大地减少伤害，驾驶后排座位有安全带的车的驾驶员让后排的同乘者也系上了安全带。': {
    en: '1. Since seat belts can greatly reduce injuries in traffic accidents, drivers of vehicles with seat belts in the rear seats have rear passengers also wear seat belts.',
    ja: '1. シートベルトは交通事故発生時に傷害を大幅に減らすことができるため、後部座席にシートベルトがある車の運転者は、後部座席の同乗者にもシートベルトを着用させます。'
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

