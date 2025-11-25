#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import re

def translate_zh_to_en(text):
    """中文到英文翻译 - 完整版"""
    if not text or not text.strip():
        return ""
    
    # 保存题号
    text = text.strip()
    number_match = re.match(r'^(\d+)\.\s*', text)
    prefix = number_match.group(0) if number_match else ''
    content = re.sub(r'^\d+\.\s*', '', text)
    
    # 处理explanation标准开头
    if content.startswith('根据题目描述，该说法是正确的'):
        rest = re.sub(r'^根据题目描述，该说法是正确的。\s*', '', content)
        return prefix + 'According to the question description, this statement is correct. ' + translate_zh_to_en(rest)
    elif content.startswith('根据题目描述，该说法是错误的') or content.startswith('根据题目描述，该说法是误的'):
        rest = re.sub(r'^根据题目描述，该说法是(错误的|误的)。\s*', '', content)
        return prefix + 'According to the question description, this statement is incorrect. ' + translate_zh_to_en(rest)
    
    if content in ['如题所述', '如题目所述']:
        return prefix + 'As stated in the question'
    
    # 使用规则进行翻译
    result = content
    
    # 完整的翻译规则
    translations = [
        # 长句子优先
        ('交通量少时，因为不会给其他行人或车辆带来麻烦，所以可以随意驾驶', 'When there is little traffic, you can drive casually because it will not cause trouble to other pedestrians or vehicles'),
        ('该标志表示是公共汽车等优先通行带，当公共汽车接近时，其它汽车必须立即驶出该通行带', 'This sign indicates a priority lane for buses and other vehicles. When a bus approaches, other vehicles must immediately exit the lane'),
        ('带有残疾人标记的行动不自由的驾驶员驾驶汽车时，不得贴近其车辆的侧面或强行加塞到其前方', 'When a driver with limited mobility displaying a disabled person\'s mark is driving, you must not drive close to the side of their vehicle or forcibly cut in front of them'),
        ('汽车在铁路道停滞不动时，如果没有发烟筒或发烟筒已用完，最好在附近点燃容易发烟的物品发出信号', 'If a vehicle stalls on a railroad crossing and there is no smoke signal or it has been used up, it is best to light easily smokable materials nearby to signal'),
        ('取得驾驶执照的人在没有携带驾驶执照的情况下驾驶汽车时属于交通违章', 'A person who has obtained a driver\'s license but drives without carrying it is committing a traffic violation'),
        ('在驾驶途中使用手机会分散对周围交通状况的注意力，较为危险', 'Using a mobile phone while driving distracts attention from the surrounding traffic conditions and is dangerous'),
        ('所谓标示，是指用涂料或路钉等在路面上标划的线段、符号和文字，分为限制标示和指示标示两种', 'Markings refer to lines, symbols, and text marked on the road surface with paint or road studs, divided into restrictive markings and indicative markings'),
        ('在交叉路准备右转弯时，虽然对面方向有二轮摩托车直行过来，但因为自己的车辆有优先权，所以可以先向右转弯', 'When preparing to turn right at an intersection, although a motorcycle is coming straight from the opposite direction, you can turn right first because your vehicle has priority'),
        ('在人行横道近前，即使明显没有横过的行人也必须减速至在人行横道近前可以停车的速度行驶', 'Near a pedestrian crossing, even if there are obviously no pedestrians crossing, you must slow down to a speed at which you can stop near the crossing'),
        ('前面的车辆在交叉路或铁路道等停车或缓行时，不得在其前面加塞或横穿', 'When the vehicle ahead stops or slows down at an intersection or railroad crossing, you must not cut in front of it or cross'),
        ('这个标示表示禁止掉头路段"结束"', 'This sign indicates the end of a no U-turn section'),
        ('图中标志是禁止泊车的标志', 'The sign in the figure is a no parking sign'),
        ('图中标志表示前方是道路的尽头', 'The sign in the figure indicates that the road ahead ends'),
        ('图中标志表示前方左转弯', 'The sign in the figure indicates a left turn ahead'),
        ('图中标志表示"中央线"，但是中央线未必一定设在道路的中央', 'The sign in the figure indicates the center line, but the center line is not necessarily located in the center of the road'),
        ('图中标志表示"机动车道路减少"', 'The sign in the figure indicates that the number of motor vehicle lanes is decreasing'),
        ('持有第一种驾驶执照的人，即使是为了把出租车运回修理，也不能驾驶', 'A person holding a Class 1 driver\'s license cannot drive even for the purpose of returning a taxi to a repair shop'),
        ('安全速度是指始终按法定速度行驶', 'Safe speed means always driving at the legal speed'),
        ('上坡属于缓行场所', 'An uphill slope is a place where you should drive slowly'),
        ('有行人在人行横道横穿道路时，但在车辆接近时行人停下来，所以车辆继续通行', 'When a pedestrian is crossing the road at a pedestrian crossing but stops when a vehicle approaches, the vehicle continues'),
        ('以30km/h的速度行驶时', 'When driving at 30km/h'),
        ('以40km/h的速度行驶时', 'When driving at 40km/h'),
        ('以80km/h的速度在高速公路', 'When driving at 80km/h on the expressway'),
        ('开车的时候，不能只考虑自己方便，要照顾到其他车辆和行人，要相互礼让驾驶', 'When driving, you should not only consider your own convenience, but also take care of other vehicles and pedestrians, and drive with mutual courtesy'),
        ('在有信号灯的交叉路想在右转弯的时候，因对面是绿灯进入了交叉路，但右转弯方向的信号是红灯时，此时在交叉路中停下来了', 'When you want to make a right turn at an intersection with traffic lights, you entered the intersection because the opposite signal was green, but the signal in the right turn direction was red, and you stopped in the intersection'),
        ('在前方的信号灯变为黄灯的时候，已接近停止位置如果不紧急刹车不能停下来的时候，可以直接进入', 'When the traffic light ahead turns yellow, if you are close to the stop position and cannot stop without emergency braking, you may proceed directly'),
        ('在有信号灯的交叉路，没有停止线的停止位置，是停在信号灯的跟前', 'At an intersection with traffic lights, if there is no stop line, the stopping position is directly in front of the traffic light'),
        ('图中警察的手势信号表示：对于面对警察的车辆来说，遇到黄灯信号灯意义相同', 'The police officer\'s hand signal in the figure means: For vehicles facing the police officer, it has the same meaning as a yellow traffic light'),
        ('在道路的拐角附近视野好的地方不用缓行', 'At a place with good visibility near a road corner, you need not slow down'),
        ('在预测有危险的地方行驶时，为了避免危险而不得已的情况下可以鸣笛', 'When driving in a place where danger is anticipated, you may sound the horn in unavoidable circumstances to avoid danger'),
        ('即使没有牵引执照也可以用缆绳或起重机牵引故障车', 'Even without a towing license, you may tow a broken-down vehicle with a rope or crane'),
        ('集团性地驾车行驶时，不得七转八弯，横冲直独地驾驶车辆，否则会给其它车辆带来麻烦', 'When driving in a group, you must not drive in a zigzag or reckless manner, as this will cause trouble for other vehicles'),
        
        # 常见短语
        ('开车的时候', 'When driving'),
        ('在道路上行驶', 'driving on the road'),
        ('交叉路', 'intersection'),
        ('信号灯', 'traffic light'),
        ('右转弯', 'right turn'),
        ('左转弯', 'left turn'),
        ('绿灯', 'green light'),
        ('红灯', 'red light'),
        ('黄灯', 'yellow light'),
        ('停止线', 'stop line'),
        ('停止位置', 'stop position'),
        ('紧急刹车', 'emergency braking'),
        ('车辆', 'vehicle'),
        ('行人', 'pedestrian'),
        ('驾驶', 'driving'),
        ('速度', 'speed'),
        ('道路', 'road'),
        ('可以', 'may'),
        ('必须', 'must'),
        ('不得', 'must not'),
        ('注意', 'pay attention to'),
        ('通过', 'pass through'),
        ('停车', 'parking'),
        ('行驶', 'drive'),
    ]
    
    for zh, en in translations:
        result = result.replace(zh, en)
    
    # 清理格式
    result = re.sub(r'\s+', ' ', result).strip()
    result = result.replace('，', ', ')
    result = result.replace('。', '.')
    
    return prefix + result

def translate_zh_to_ja(text):
    """中文到日文翻译 - 完整版"""
    if not text or not text.strip():
        return ""
    
    # 保存题号
    text = text.strip()
    number_match = re.match(r'^(\d+)\.\s*', text)
    prefix = number_match.group(0) if number_match else ''
    content = re.sub(r'^\d+\.\s*', '', text)
    
    # 处理explanation标准开头
    if content.startswith('根据题目描述，该说法是正确的'):
        rest = re.sub(r'^根据题目描述，该说法是正确的。\s*', '', content)
        return prefix + '問題文の通り、この記述は正しいです。' + translate_zh_to_ja(rest)
    elif content.startswith('根据题目描述，该说法是错误的') or content.startswith('根据题目描述，该说法是误的'):
        rest = re.sub(r'^根据题目描述，该说法是(错误的|误的)。\s*', '', content)
        return prefix + '問題文の通り、この記述は誤りです。' + translate_zh_to_ja(rest)
    
    if content in ['如题所述', '如题目所述']:
        return prefix + '問題文の通り'
    
    # 使用规则进行翻译
    result = content
    
    # 完整的翻译规则
    translations = [
        # 长句子优先
        ('交通量少时，因为不会给其他行人或车辆带来麻烦，所以可以随意驾驶', '交通量が少ないときは、他の歩行者や車両に迷惑をかけないので、自由に運転できます'),
        ('该标志表示是公共汽车等优先通行带，当公共汽车接近时，其它汽车必须立即驶出该通行带', 'この標識はバスなどの優先通行帯を示しており、バスが接近したとき、他の車両は直ちにその通行帯から出なければなりません'),
        ('带有残疾人标记的行动不自由的驾驶员驾驶汽车时，不得贴近其车辆的侧面或强行加塞到其前方', '身体障害者マークを表示している運転者が運転している場合、その車両の側面に近づいたり、強引に前に割り込んだりしてはいけません'),
        ('汽车在铁路道停滞不动时，如果没有发烟筒或发烟筒已用完，最好在附近点燃容易发烟的物品发出信号', '踏切で車両が動けなくなったとき、発煙筒がないか使い果たした場合は、近くで煙が出やすいものを燃やして信号を出すのが最善です'),
        ('取得驾驶执照的人在没有携带驾驶执照的情况下驾驶汽车时属于交通违章', '運転免許を取得した者が免許証を携帯せずに運転することは交通違反にあたります'),
        ('在驾驶途中使用手机会分散对周围交通状况的注意力，较为危险', '運転中に携帯電話を使用すると、周囲の交通状況への注意が散漫になり、危険です'),
        ('所谓标示，是指用涂料或路钉等在路面上标划的线段、符号和文字，分为限制标示和指示标示两种', '標示とは、塗料や路面鋲などで路面に標示された線、記号、文字のことで、規制標示と指示標示の2種類に分けられます'),
        ('在交叉路准备右转弯时，虽然对面方向有二轮摩托车直行过来，但因为自己的车辆有优先权，所以可以先向右转弯', '交差点で右折の準備をしているとき、対向からバイクが直進してきても、自分の車両に優先権があるので先に右折できます'),
        ('在人行横道近前，即使明显没有横过的行人也必须减速至在人行横道近前可以停车的速度行驶', '横断歩道の手前では、明らかに横断する歩行者がいなくても、横断歩道の手前で停止できる速度まで減速しなければなりません'),
        ('前面的车辆在交叉路或铁路道等停车或缓行时，不得在其前面加塞或横穿', '前方の車両が交差点や踏切などで停止または徐行しているとき、その前に割り込んだり横切ったりしてはいけません'),
        ('这个标示表示禁止掉头路段"结束"', 'この標示は転回禁止区間の「終了」を表します'),
        ('图中标志是禁止泊车的标志', '図中の標識は駐車禁止の標識です'),
        ('图中标志表示前方是道路的尽头', '図中の標識は前方が道路の行き止まりであることを示しています'),
        ('图中标志表示前方左转弯', '図中の標識は前方に左折があることを示しています'),
        ('图中标志表示"中央线"，但是中央线未必一定设在道路的中央', '図中の標識は「中央線」を示していますが、中央線は必ずしも道路の中央に設置されているとは限りません'),
        ('图中标志表示"机动车道路减少"', '図中の標識は「車線数減少」を示しています'),
        ('持有第一种驾驶执照的人，即使是为了把出租车运回修理，也不能驾驶', '第一種運転免許を所持している者でも、タクシーを修理に運ぶ目的であっても運転することはできません'),
        ('安全速度是指始终按法定速度行驶', '安全速度とは、常に法定速度で走行することを意味します'),
        ('上坡属于缓行场所', '上り坂は徐行場所にあたります'),
        ('有行人在人行横道横穿道路时，但在车辆接近时行人停下来，所以车辆继续通行', '歩行者が横断歩道を横断しているとき、車両が接近すると歩行者が立ち止まったので、車両は通行を続けました'),
        ('以30km/h的速度行驶时', '30km/hの速度で走行する際'),
        ('以40km/h的速度行驶时', '40km/hの速度で走行する際'),
        ('以80km/h的速度在高速公路', '高速道路で80km/hの速度で'),
        ('开车的时候，不能只考虑自己方便，要照顾到其他车辆和行人，要相互礼让驾驶', '運転する際は、自分の都合だけを考えるのではなく、他の車両や歩行者に配慮し、相互に譲り合って運転する必要があります'),
        ('在有信号灯的交叉路想在右转弯的时候，因对面是绿灯进入了交叉路，但右转弯方向的信号是红灯时，此时在交叉路中停下来了', '信号機のある交差点で右折しようとした際、対向が青信号で交差点に入ったが、右折方向の信号が赤信号だったため、交差点内で停車した'),
        ('在前方的信号灯变为黄灯的时候，已接近停止位置如果不紧急刹车不能停下来的时候，可以直接进入', '前方の信号機が黄色に変わったとき、停止位置に近づいており、緊急ブレーキをかけなければ止まれない場合は、そのまま進入してもよい'),
        ('在有信号灯的交叉路，没有停止线的停止位置，是停在信号灯的跟前', '信号機のある交差点で、停止線がない場合の停止位置は、信号機の直前である'),
        ('图中警察的手势信号表示：对于面对警察的车辆来说，遇到黄灯信号灯意义相同', '図中の警察官の手信号は、警察官に向かう車両にとって、黄色信号と同じ意味を表します'),
        ('在道路的拐角附近视野好的地方不用缓行', '道路の角付近で見通しの良い場所では、徐行する必要はありません'),
        ('在预测有危险的地方行驶时，为了避免危险而不得已的情况下可以鸣笛', '危険が予測される場所を走行する際、危険を避けるためにやむを得ない場合は、警音器を鳴らすことができます'),
        ('即使没有牵引执照也可以用缆绳或起重机牵引故障车', '牽引免許がなくても、ロープやクレーンで故障車を牽引することができます'),
        ('集团性地驾车行驶时，不得七转八弯，横冲直独地驾驶车辆，否则会给其它车辆带来麻烦', '集団で車を運転する際は、七転八倒したり、横暴に運転したりしてはいけません。そうしないと、他の車両に迷惑をかけることになります'),
        
        # 常见短语
        ('开车的时候', '運転する際は'),
        ('在道路上行驶', '道路上で運転'),
        ('交叉路', '交差点'),
        ('信号灯', '信号機'),
        ('右转弯', '右折'),
        ('左转弯', '左折'),
        ('绿灯', '青信号'),
        ('红灯', '赤信号'),
        ('黄灯', '黄色信号'),
        ('停止线', '停止線'),
        ('停止位置', '停止位置'),
        ('紧急刹车', '緊急ブレーキ'),
        ('车辆', '車両'),
        ('行人', '歩行者'),
        ('驾驶', '運転'),
        ('速度', '速度'),
        ('道路', '道路'),
        ('可以', 'できます'),
        ('必须', 'しなければなりません'),
        ('不得', 'してはいけません'),
        ('注意', '注意'),
        ('通过', '通過'),
        ('停车', '駐車'),
        ('行驶', '走行'),
    ]
    
    for zh, ja in translations:
        result = result.replace(zh, ja)
    
    # 清理格式
    result = re.sub(r'\s+', ' ', result).strip()
    
    return prefix + result

def main():
    # 读取文件
    print("读取文件...")
    with open('src/data/questions/zh/questions_auto_tag.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"总问题数: {len(questions)}")
    
    # 处理所有问题
    print("开始翻译...")
    translated_count = 0
    
    for i, q in enumerate(questions):
        # 处理content
        if q.get('content'):
            zh = q['content'].get('zh', '')
            
            # 翻译en
            if zh:
                en = q['content'].get('en', '')
                if not en or en.strip() == '' or re.search(r'[\u4e00-\u9fa5]', en):
                    q['content']['en'] = translate_zh_to_en(zh)
                    translated_count += 1
            
            # 翻译ja
            if zh:
                ja = q['content'].get('ja', '')
                if not ja or ja.strip() == '' or re.search(r'[\u4e00-\u9fa5]', ja):
                    q['content']['ja'] = translate_zh_to_ja(zh)
                    translated_count += 1
        
        # 处理explanation
        if q.get('explanation'):
            zh = q['explanation'].get('zh', '')
            
            # 翻译en
            if zh:
                en = q['explanation'].get('en', '')
                if not en or en.strip() == '' or re.search(r'[\u4e00-\u9fa5]', en):
                    q['explanation']['en'] = translate_zh_to_en(zh)
                    translated_count += 1
            
            # 翻译ja
            if zh:
                ja = q['explanation'].get('ja', '')
                if not ja or ja.strip() == '' or re.search(r'[\u4e00-\u9fa5]', ja):
                    q['explanation']['ja'] = translate_zh_to_ja(zh)
                    translated_count += 1
        
        if (i + 1) % 100 == 0:
            print(f"已处理 {i + 1}/{len(questions)} 个问题...")
    
    # 保存文件
    print("保存文件...")
    with open('src/data/questions/zh/questions_auto_tag.json', 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print(f"完成！共翻译了 {translated_count} 个字段。")
    
    # 验证
    print("\n验证翻译结果...")
    remaining = 0
    for q in questions:
        if q.get('content'):
            en = q['content'].get('en', '')
            ja = q['content'].get('ja', '')
            if not en or not ja or re.search(r'[\u4e00-\u9fa5]', en) or re.search(r'[\u4e00-\u9fa5]', ja):
                remaining += 1
        if q.get('explanation'):
            en = q['explanation'].get('en', '')
            ja = q['explanation'].get('ja', '')
            if not en or not ja or re.search(r'[\u4e00-\u9fa5]', en) or re.search(r'[\u4e00-\u9fa5]', ja):
                remaining += 1
    
    print(f"剩余需要翻译的字段: {remaining}")

if __name__ == '__main__':
    main()

