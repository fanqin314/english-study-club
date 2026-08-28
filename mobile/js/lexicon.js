/* ============================================================
   lexicon.js — 本地高频基础词表（省 token 用）
   · 命中即本地返回「最常用义」，不消耗 AI token；
   · 未命中（生僻 / 复杂 / 需语境的词）仍走 AI，质量不变。
   · 仅含最常用义，多义词以基础义为准；不规则变形显式收录，
     常规变形（复数/三单 -s、-ed、-ing、副词 -ly、ies→y）自动回退。
   · 纯静态数据，常驻内存，O(1) 查找，离线可用。
   ============================================================ */
(function (global) {
  'use strict';
  var Mobile = global.Mobile = global.Mobile || {};

  // 键统一为小写原型；值为基础中文释义
  var MAP = {
    /* ---- 功能词：冠词 / 代词 / 限定词 ---- */
    'the': '这/那（定冠词）', 'a': '一个（不定冠词）', 'an': '一个（用于元音前）',
    'this': '这，这个', 'that': '那，那个', 'these': '这些', 'those': '那些',
    'my': '我的', 'your': '你的', 'his': '他的', 'her': '她的', 'its': '它的',
    'our': '我们的', 'their': '他们的', 'mine': '我的', 'yours': '你的',
    'ours': '我们的', 'theirs': '他们的',
    'some': '一些', 'any': '任何；一些', 'no': '没有', 'every': '每个', 'each': '每个',
    'another': '另一个', 'other': '其他的', 'others': '其他人/物',
    'all': '全部', 'both': '两者都', 'either': '任一', 'neither': '两者都不',
    'such': '这样的', 'what': '什么', 'which': '哪一个', 'who': '谁', 'whom': '谁（宾格）',
    'whose': '谁的', 'why': '为什么', 'when': '何时', 'where': '哪里', 'how': '怎样',

    /* ---- 功能词：连词 / 介词 ---- */
    'and': '和，并且', 'or': '或者', 'but': '但是', 'because': '因为', 'so': '所以',
    'if': '如果', 'while': '当…时；然而', 'although': '虽然', 'though': '虽然',
    'however': '然而', 'therefore': '因此', 'thus': '因此', 'also': '也', 'too': '也',
    'not': '不', 'nor': '也不',
    'of': '…的', 'for': '为了；对于', 'to': '到；向', 'in': '在…里', 'on': '在…上',
    'at': '在（某处/时刻）', 'by': '被；由；在…旁', 'with': '和…一起；用',
    'from': '从；来自', 'about': '关于；大约', 'into': '进入', 'onto': '到…上',
    'over': '在…上方；超过', 'under': '在…下面', 'after': '在…之后',
    'before': '在…之前', 'during': '在…期间', 'without': '没有',
    'through': '穿过', 'across': '穿过', 'as': '作为；当…时', 'than': '比',
    'until': '直到', 'since': '自从；因为', 'against': '反对；靠着',
    'between': '在…之间', 'among': '在…之中', 'around': '围绕；大约',
    'upon': '在…上', 'within': '在…之内', 'toward': '朝向',

    /* ---- 动词（含不规则变形） ---- */
    'be': '是；存在', 'am': '是（第一人称）', 'is': '是（三单）', 'are': '是（复数）',
    'was': '是（过去式）', 'were': '是（过去式复数）', 'been': '是（过去分词）', 'being': '是（现在分词）',
    'have': '有', 'has': '有（三单）', 'had': '有（过去式）', 'having': '有（现在分词）',
    'do': '做', 'does': '做（三单）', 'did': '做（过去式）', 'done': '做（过去分词）', 'doing': '做（现在分词）',
    'go': '去', 'goes': '去（三单）', 'went': '去（过去式）', 'gone': '去（过去分词）', 'going': '去（现在分词）',
    'come': '来', 'came': '来（过去式）', 'coming': '来（现在分词）',
    'get': '得到；变得', 'gets': '得到（三单）', 'got': '得到（过去式）', 'gotten': '得到（过去分词）', 'getting': '得到（现在分词）',
    'make': '做；制造', 'makes': '做（三单）', 'made': '做（过去式）', 'making': '做（现在分词）',
    'take': '拿；花费', 'takes': '拿（三单）', 'took': '拿（过去式）', 'taken': '拿（过去分词）', 'taking': '拿（现在分词）',
    'see': '看见', 'sees': '看见（三单）', 'saw': '看见（过去式）', 'seen': '看见（过去分词）', 'seeing': '看见（现在分词）',
    'look': '看；看起来', 'looking': '看（现在分词）',
    'want': '想要', 'need': '需要', 'like': '喜欢；像', 'use': '使用', 'used': '使用（过去式）',
    'find': '找到', 'found': '找到（过去式）', 'finding': '找到（现在分词）',
    'give': '给', 'gives': '给（三单）', 'gave': '给（过去式）', 'given': '给（过去分词）', 'giving': '给（现在分词）',
    'tell': '告诉', 'tells': '告诉（三单）', 'told': '告诉（过去式）',
    'work': '工作', 'works': '工作（三单）', 'worked': '工作（过去式）', 'working': '工作（现在分词）',
    'call': '呼叫；称呼', 'called': '呼叫（过去式）',
    'try': '尝试', 'tried': '尝试（过去式）', 'trying': '尝试（现在分词）',
    'ask': '问', 'asked': '问（过去式）',
    'seem': '似乎', 'seemed': '似乎（过去式）',
    'feel': '感觉', 'feels': '感觉（三单）', 'felt': '感觉（过去式）', 'feeling': '感觉（现在分词）',
    'become': '变成', 'became': '变成（过去式）', 'becoming': '变成（现在分词）',
    'leave': '离开', 'leaves': '离开（三单）', 'left': '离开（过去式）',
    'put': '放', 'puts': '放（三单）', 'putting': '放（现在分词）',
    'keep': '保持', 'keeps': '保持（三单）', 'kept': '保持（过去式）', 'keeping': '保持（现在分词）',
    'let': '让', 'lets': '让（三单）',
    'begin': '开始', 'begins': '开始（三单）', 'began': '开始（过去式）', 'beginning': '开始（现在分词）',
    'help': '帮助', 'helped': '帮助（过去式）', 'helping': '帮助（现在分词）',
    'talk': '说话', 'talked': '说话（过去式）',
    'turn': '转动；变成', 'turned': '转动（过去式）',
    'start': '开始', 'starts': '开始（三单）', 'started': '开始（过去式）',
    'run': '跑', 'runs': '跑（三单）', 'ran': '跑（过去式）', 'running': '跑（现在分词）',
    'walk': '走', 'walked': '走（过去式）',
    'eat': '吃', 'eats': '吃（三单）', 'ate': '吃（过去式）', 'eaten': '吃（过去分词）', 'eating': '吃（现在分词）',
    'drink': '喝', 'drinks': '喝（三单）', 'drank': '喝（过去式）', 'drunk': '喝（过去分词）',
    'read': '读', 'reads': '读（三单）', 'reading': '读（现在分词）',
    'write': '写', 'writes': '写（三单）', 'wrote': '写（过去式）', 'written': '写（过去分词）', 'writing': '写（现在分词）',
    'speak': '说', 'speaks': '说（三单）', 'spoke': '说（过去式）', 'spoken': '说（过去分词）', 'speaking': '说（现在分词）',
    'hear': '听见', 'hears': '听见（三单）', 'heard': '听见（过去式）', 'hearing': '听见（现在分词）',
    'know': '知道', 'knows': '知道（三单）', 'knew': '知道（过去式）', 'known': '知道（过去分词）', 'knowing': '知道（现在分词）',
    'think': '想；认为', 'thinks': '想（三单）', 'thought': '想（过去式）', 'thinking': '想（现在分词）',
    'understand': '理解', 'understands': '理解（三单）', 'understood': '理解（过去式）',
    'learn': '学习；研究', 'learns': '学习（三单）', 'learned': '学习（过去式）', 'learning': '学习（现在分词）',
    'play': '玩；演奏', 'plays': '玩（三单）', 'played': '玩（过去式）', 'playing': '玩（现在分词）',
    'live': '居住；生活', 'lives': '居住（三单）', 'lived': '居住（过去式）', 'living': '居住（现在分词）',
    'love': '爱', 'loves': '爱（三单）', 'loved': '爱（过去式）', 'loving': '爱（现在分词）',
    'hate': '恨', 'hated': '恨（过去式）',
    'show': '展示', 'shows': '展示（三单）', 'showed': '展示（过去式）', 'shown': '展示（过去分词）',
    'bring': '带来', 'brings': '带来（三单）', 'brought': '带来（过去式）', 'bringing': '带来（现在分词）',
    'buy': '买', 'buys': '买（三单）', 'bought': '买（过去式）', 'buying': '买（现在分词）',
    'sell': '卖', 'sells': '卖（三单）', 'sold': '卖（过去式）', 'selling': '卖（现在分词）',
    'pay': '支付', 'pays': '支付（三单）', 'paid': '支付（过去式）', 'paying': '支付（现在分词）',
    'open': '打开', 'opens': '打开（三单）', 'opened': '打开（过去式）',
    'close': '关闭', 'closes': '关闭（三单）', 'closed': '关闭（过去式）', 'closing': '关闭（现在分词）',
    'stop': '停止', 'stops': '停止（三单）', 'stopped': '停止（过去式）', 'stopping': '停止（现在分词）',
    'move': '移动', 'moved': '移动（过去式）', 'moving': '移动（现在分词）',
    'change': '改变', 'changed': '改变（过去式）', 'changing': '改变（现在分词）',
    'follow': '跟随', 'followed': '跟随（过去式）',
    'answer': '回答；答案', 'answered': '回答（过去式）',
    'remember': '记得', 'remembered': '记得（过去式）',
    'forget': '忘记', 'forgot': '忘记（过去式）', 'forgotten': '忘记（过去分词）',
    'meet': '遇见', 'meets': '遇见（三单）', 'met': '遇见（过去式）', 'meeting': '遇见（现在分词）',
    'build': '建造', 'built': '建造（过去式）', 'building': '建造（现在分词）',
    'grow': '生长；变得', 'grows': '生长（三单）', 'grew': '生长（过去式）', 'grown': '生长（过去分词）', 'growing': '生长（现在分词）',
    'hold': '持有；容纳', 'holds': '持有（三单）', 'held': '持有（过去式）', 'holding': '持有（现在分词）',
    'break': '打破', 'broke': '打破（过去式）', 'broken': '打破（过去分词）', 'breaking': '打破（现在分词）',
    'catch': '抓住', 'catches': '抓住（三单）', 'caught': '抓住（过去式）', 'catching': '抓住（现在分词）',
    'throw': '扔', 'threw': '扔（过去式）', 'thrown': '扔（过去分词）', 'throwing': '扔（现在分词）',
    'send': '发送', 'sent': '发送（过去式）', 'sending': '发送（现在分词）',
    'receive': '接收', 'received': '接收（过去式）',
    'win': '赢', 'won': '赢（过去式）', 'winning': '赢（现在分词）',
    'lose': '失去', 'lost': '失去（过去式）', 'losing': '失去（现在分词）',
    'study': '学习；研究', 'studies': '学习（三单）', 'studied': '学习（过去式）', 'studying': '学习（现在分词）',
    'teach': '教', 'teaches': '教（三单）', 'taught': '教（过去式）', 'teaching': '教（现在分词）',
    'travel': '旅行', 'traveled': '旅行（过去式）', 'travelling': '旅行（现在分词）',
    'return': '返回', 'returned': '返回（过去式）',
    'stay': '停留', 'stayed': '停留（过去式）',
    'wait': '等待', 'waited': '等待（过去式）',
    'hope': '希望', 'hoped': '希望（过去式）', 'hoping': '希望（现在分词）',
    'wish': '希望；祝愿', 'wished': '希望（过去式）',
    'believe': '相信', 'believed': '相信（过去式）',
    'mean': '意思是', 'means': '意思是（三单）', 'meant': '意思是（过去式）', 'meaning': '意思是（现在分词）',
    'include': '包括', 'included': '包括（过去式）',
    'appear': '出现', 'appeared': '出现（过去式）',
    'exist': '存在', 'existed': '存在（过去式）',
    'sit': '坐', 'sits': '坐（三单）', 'sat': '坐（过去式）', 'sitting': '坐（现在分词）',
    'stand': '站', 'stands': '站（三单）', 'stood': '站（过去式）', 'standing': '站（现在分词）',
    'smile': '微笑', 'smiled': '微笑（过去式）',
    'thank': '感谢', 'thanks': '感谢（三单）', 'thanked': '感谢（过去式）',
    'worry': '担心', 'worried': '担心（过去式）',
    'die': '死', 'died': '死（过去式）', 'dying': '死（现在分词）',
    'fall': '落下', 'fell': '落下（过去式）', 'fallen': '落下（过去分词）', 'falling': '落下（现在分词）',
    'carry': '携带', 'carried': '携带（过去式）',
    'pull': '拉', 'pulled': '拉（过去式）', 'push': '推', 'pushed': '推（过去式）',

    /* ---- 名词 ---- */
    'man': '男人', 'men': '男人们', 'woman': '女人', 'women': '女人们',
    'child': '孩子', 'children': '孩子们', 'people': '人们', 'person': '人',
    'school': '学校', 'schools': '学校（复数）', 'time': '时间；次', 'times': '次数；时代',
    'day': '天', 'days': '天（复数）', 'year': '年', 'years': '年（复数）',
    'world': '世界', 'life': '生活；生命', 'lives': '生活（复数）', 'hand': '手',
    'hands': '手（复数）', 'part': '部分', 'parts': '部分（复数）', 'eye': '眼睛',
    'eyes': '眼睛（复数）', 'place': '地方', 'places': '地方（复数）', 'case': '情况；案例',
    'point': '点；要点', 'points': '点（复数）', 'government': '政府', 'company': '公司',
    'number': '数字；数量', 'group': '组；群', 'problem': '问题', 'fact': '事实',
    'home': '家', 'water': '水', 'room': '房间', 'rooms': '房间（复数）',
    'mother': '母亲', 'father': '父亲', 'friend': '朋友', 'friends': '朋友（复数）',
    'book': '书', 'books': '书（复数）', 'word': '单词；词', 'words': '单词（复数）',
    'line': '线；行', 'city': '城市', 'family': '家庭', 'families': '家庭（复数）',
    'student': '学生', 'teacher': '老师', 'country': '国家', 'money': '钱',
    'food': '食物', 'house': '房子', 'car': '汽车', 'door': '门',
    'name': '名字', 'head': '头', 'face': '脸', 'night': '夜晚',
    'morning': '早晨', 'evening': '晚上', 'week': '周', 'month': '月',
    'hour': '小时', 'minute': '分钟', 'idea': '主意', 'story': '故事',
    'question': '问题', 'answer': '答案', 'example': '例子', 'result': '结果',
    'light': '光；灯', 'fire': '火', 'earth': '地球', 'sun': '太阳',
    'moon': '月亮', 'star': '星星', 'stars': '星星（复数）', 'tree': '树',
    'animal': '动物', 'dog': '狗', 'cat': '猫', 'bird': '鸟', 'fish': '鱼',
    'horse': '马', 'road': '路', 'street': '街道', 'train': '火车',
    'bus': '公交车', 'plane': '飞机', 'phone': '电话', 'computer': '电脑',
    'internet': '互联网', 'language': '语言', 'music': '音乐', 'art': '艺术',
    'science': '科学', 'math': '数学', 'history': '历史', 'health': '健康',
    'job': '工作', 'business': '生意', 'market': '市场', 'shop': '商店',
    'store': '商店', 'hospital': '医院', 'office': '办公室', 'class': '课；班级',
    'lesson': '课', 'test': '测试', 'exam': '考试', 'grade': '年级；成绩',
    'letter': '信；字母', 'email': '电子邮件', 'news': '新闻', 'information': '信息',
    'message': '消息', 'picture': '图片', 'color': '颜色', 'colour': '颜色',
    'size': '尺寸', 'shape': '形状', 'side': '边；侧', 'end': '结束；末端',
    'top': '顶部', 'bottom': '底部', 'front': '前面', 'back': '后面',
    'center': '中心', 'centre': '中心', 'inside': '里面', 'outside': '外面',
    'thing': '东西；事情', 'things': '东西（复数）', 'way': '方式；路',
    'letter': '信；字母', 'word': '单词',

    /* ---- 形容词 ---- */
    'good': '好的', 'bad': '坏的', 'big': '大的', 'small': '小的', 'long': '长的',
    'short': '短的', 'high': '高的', 'low': '低的', 'old': '老的；旧的', 'new': '新的',
    'young': '年轻的', 'hot': '热的', 'cold': '冷的', 'warm': '温暖的', 'cool': '凉爽的',
    'happy': '快乐的', 'sad': '悲伤的', 'angry': '生气的', 'tired': '累的', 'hungry': '饿的',
    'full': '满的', 'empty': '空的', 'clean': '干净的', 'dirty': '脏的', 'easy': '容易的',
    'hard': '难的；硬的', 'difficult': '困难的', 'fast': '快的', 'slow': '慢的',
    'early': '早的', 'late': '晚的', 'rich': '富的', 'poor': '穷的',
    'free': '自由的；免费的', 'busy': '忙的', 'quiet': '安静的', 'loud': '大声的',
    'beautiful': '美丽的', 'strong': '强壮的', 'weak': '弱的', 'heavy': '重的',
    'light': '轻的；亮的', 'red': '红色', 'blue': '蓝色', 'green': '绿色',
    'yellow': '黄色', 'black': '黑色', 'white': '白色', 'dark': '暗的', 'bright': '明亮的',
    'same': '相同的', 'different': '不同的', 'right': '正确的；右边的', 'wrong': '错误的',
    'true': '真的', 'false': '假的', 'important': '重要的', 'possible': '可能的',
    'real': '真实的', 'strange': '奇怪的', 'normal': '正常的', 'special': '特别的',
    'common': '常见的', 'main': '主要的', 'total': '总的', 'final': '最后的',
    'next': '下一个', 'last': '上一个；最后的', 'first': '第一', 'second': '第二',
    'little': '小的；少的', 'few': '少的', 'many': '许多', 'much': '许多',
    'more': '更多', 'most': '最多', 'less': '更少', 'least': '最少', 'enough': '足够的',
    'own': '自己的', 'great': '伟大的；很棒的', 'large': '大的', 'clear': '清晰的',
    'kind': '善良的；种类', 'able': '能够的', 'ready': '准备好的', 'sure': '确定的',
    'available': '可获得的', 'public': '公共的', 'private': '私人的',

    /* ---- 副词 ---- */
    'now': '现在', 'then': '然后；那时', 'here': '这里', 'there': '那里',
    'today': '今天', 'tomorrow': '明天', 'yesterday': '昨天', 'always': '总是',
    'never': '从不', 'often': '经常', 'sometimes': '有时', 'usually': '通常',
    'soon': '不久', 'already': '已经', 'just': '刚刚', 'very': '非常',
    'quite': '相当', 'really': '真正地', 'almost': '几乎', 'even': '甚至',
    'only': '仅仅', 'again': '再次', 'still': '仍然', 'away': '离开',
    'well': '好地', 'badly': '糟糕地', 'quickly': '快速地', 'slowly': '缓慢地',
    'together': '一起', 'perhaps': '也许', 'maybe': '也许', 'certainly': '当然',
    'probably': '可能', 'instead': '反而', 'forward': '向前'
  };

  // 音标（英式 IPA，best-effort；后续可校验修正）
  // 键与 MAP 基础词一致；不规则变形（is/are/went…）单独给出以便发音准确
  var PHON = {
    'the': 'ðə', 'a': 'ə', 'an': 'ən', 'this': 'ðɪs', 'that': 'ðæt', 'these': 'ðiːz', 'those': 'ðəʊz',
    'my': 'maɪ', 'your': 'jɔː', 'his': 'hɪz', 'her': 'hɜː', 'its': 'ɪts', 'our': 'aʊə', 'their': 'ðeə',
    'mine': 'maɪn', 'yours': 'jɔːz', 'ours': 'aʊəz', 'theirs': 'ðeəz', 'some': 'sʌm', 'any': 'ˈeni',
    'no': 'nəʊ', 'every': 'ˈevri', 'each': 'iːtʃ', 'another': 'əˈnʌðə', 'other': 'ˈʌðə', 'others': 'ˈʌðəz',
    'all': 'ɔːl', 'both': 'bəʊθ', 'either': 'ˈaɪðə', 'neither': 'ˈnaɪðə', 'such': 'sʌtʃ',
    'what': 'wɒt', 'which': 'wɪtʃ', 'who': 'huː', 'whom': 'huːm', 'whose': 'huːz',
    'why': 'waɪ', 'when': 'wen', 'where': 'weə', 'how': 'haʊ',
    'and': 'ænd', 'or': 'ɔː', 'but': 'bʌt', 'because': 'bɪˈkɒz', 'so': 'səʊ', 'if': 'ɪf',
    'while': 'waɪl', 'although': 'ɔːlˈðəʊ', 'though': 'ðəʊ', 'however': 'haʊˈevə',
    'therefore': 'ˈðeəfɔː', 'thus': 'ðʌs', 'also': 'ˈɔːlsəʊ', 'too': 'tuː', 'not': 'nɒt',
    'nor': 'nɔː', 'of': 'ɒv', 'for': 'fɔː', 'to': 'tuː', 'in': 'ɪn', 'on': 'ɒn', 'at': 'æt',
    'by': 'baɪ', 'with': 'wɪð', 'from': 'frɒm', 'about': 'əˈbaʊt', 'into': 'ˈɪntuː',
    'onto': 'ˈɒntuː', 'over': 'ˈəʊvə', 'under': 'ˈʌndə', 'after': 'ˈɑːftə',
    'before': 'bɪˈfɔː', 'during': 'ˈdjʊərɪŋ', 'without': 'wɪˈðaʊt', 'through': 'θruː',
    'across': 'əˈkrɒs', 'as': 'æz', 'than': 'ðæn', 'until': 'ənˈtɪl', 'since': 'sɪns',
    'against': 'əˈgenst', 'between': 'bɪˈtwiːn', 'among': 'əˈmʌŋ', 'around': 'əˈraʊnd',
    'upon': 'əˈpɒn', 'within': 'wɪˈðɪn', 'toward': 'təˈwɔːd',
    'be': 'biː', 'am': 'æm', 'is': 'ɪz', 'are': 'ɑː', 'was': 'wɒz', 'were': 'wɜː', 'been': 'biːn', 'being': 'ˈbiːɪŋ',
    'have': 'hæv', 'has': 'hæz', 'had': 'hæd',
    'do': 'duː', 'does': 'dʌz', 'did': 'dɪd',
    'go': 'ɡəʊ', 'goes': 'ɡəʊz', 'went': 'went', 'gone': 'ɡɒn', 'going': 'ˈɡəʊɪŋ',
    'come': 'kʌm', 'came': 'keɪm', 'coming': 'ˈkʌmɪŋ',
    'get': 'ɡet', 'got': 'ɡɒt', 'gotten': 'ˈɡɒtn', 'getting': 'ˈɡetɪŋ',
    'make': 'meɪk', 'made': 'meɪd', 'making': 'ˈmeɪkɪŋ',
    'take': 'teɪk', 'took': 'tʊk', 'taken': 'ˈteɪkən', 'taking': 'ˈteɪkɪŋ',
    'see': 'siː', 'saw': 'sɔː', 'seen': 'siːn', 'seeing': 'ˈsiːɪŋ',
    'look': 'lʊk', 'looking': 'ˈlʊkɪŋ',
    'want': 'wɒnt', 'need': 'niːd', 'like': 'laɪk', 'use': 'juːz', 'used': 'juːzd',
    'find': 'faɪnd', 'found': 'faʊnd', 'finding': 'ˈfaɪndɪŋ',
    'give': 'ɡɪv', 'gave': 'ɡeɪv', 'given': 'ˈɡɪvn', 'giving': 'ˈɡɪvɪŋ',
    'tell': 'tel', 'told': 'təʊld',
    'work': 'wɜːk', 'works': 'wɜːks', 'worked': 'wɜːkt',
    'call': 'kɔːl', 'called': 'kɔːld',
    'try': 'traɪ', 'tried': 'traɪd', 'trying': 'ˈtraɪɪŋ',
    'ask': 'ɑːsk', 'asked': 'ɑːskt',
    'seem': 'siːm', 'seemed': 'siːmd',
    'feel': 'fiːl', 'felt': 'felt', 'feeling': 'ˈfiːlɪŋ',
    'become': 'bɪˈkʌm', 'became': 'bɪˈkeɪm', 'becoming': 'bɪˈkʌmɪŋ',
    'leave': 'liːv', 'left': 'left',
    'put': 'pʊt', 'puts': 'pʊts', 'putting': 'ˈpʊtɪŋ',
    'keep': 'kiːp', 'kept': 'kept', 'keeping': 'ˈkiːpɪŋ',
    'let': 'let', 'lets': 'lets',
    'begin': 'bɪˈɡɪn', 'began': 'bɪˈɡæn', 'beginning': 'bɪˈɡɪnɪŋ',
    'help': 'help', 'helped': 'helpt',
    'talk': 'tɔːk', 'talked': 'tɔːkt',
    'turn': 'tɜːn', 'turned': 'tɜːnd',
    'start': 'stɑːt', 'started': 'ˈstɑːtɪd',
    'run': 'rʌn', 'ran': 'ræn', 'running': 'ˈrʌnɪŋ',
    'walk': 'wɔːk', 'walked': 'wɔːkt',
    'eat': 'iːt', 'ate': 'eɪt', 'eaten': 'ˈiːtn', 'eating': 'ˈiːtɪŋ',
    'drink': 'drɪŋk', 'drank': 'dræŋk', 'drunk': 'drʌŋk',
    'read': 'riːd', 'reads': 'riːdz', 'reading': 'ˈriːdɪŋ',
    'write': 'raɪt', 'wrote': 'rəʊt', 'written': 'ˈrɪtn', 'writing': 'ˈraɪtɪŋ',
    'speak': 'spiːk', 'spoke': 'spəʊk', 'spoken': 'ˈspəʊkən', 'speaking': 'ˈspiːkɪŋ',
    'hear': 'hɪə', 'heard': 'hɜːd', 'hearing': 'ˈhɪərɪŋ',
    'know': 'nəʊ', 'knew': 'njuː', 'known': 'nəʊn', 'knowing': 'ˈnəʊɪŋ',
    'think': 'θɪŋk', 'thought': 'θɔːt', 'thinking': 'ˈθɪŋkɪŋ',
    'understand': 'ˌʌndəˈstænd', 'understood': 'ˌʌndəˈstʊd',
    'learn': 'lɜːn', 'learned': 'lɜːnd', 'learning': 'ˈlɜːnɪŋ',
    'play': 'pleɪ', 'played': 'pleɪd', 'playing': 'ˈpleɪɪŋ',
    'live': 'lɪv', 'lived': 'lɪvd', 'living': 'ˈlɪvɪŋ',
    'love': 'lʌv', 'loved': 'lʌvd', 'loving': 'ˈlʌvɪŋ',
    'hate': 'heɪt', 'hated': 'ˈheɪtɪd',
    'show': 'ʃəʊ', 'showed': 'ʃəʊd', 'shown': 'ʃəʊn',
    'bring': 'brɪŋ', 'brought': 'brɔːt', 'bringing': 'ˈbrɪŋɪŋ',
    'buy': 'baɪ', 'bought': 'bɔːt', 'buying': 'ˈbaɪɪŋ',
    'sell': 'sel', 'sold': 'səʊld', 'selling': 'ˈselɪŋ',
    'pay': 'peɪ', 'paid': 'peɪd', 'paying': 'ˈpeɪɪŋ',
    'open': 'ˈəʊpən', 'opened': 'ˈəʊpənd',
    'close': 'kləʊz', 'closed': 'kləʊzd', 'closing': 'ˈkləʊzɪŋ',
    'stop': 'stɒp', 'stopped': 'stɒpt', 'stopping': 'ˈstɒpɪŋ',
    'move': 'muːv', 'moved': 'muːvd', 'moving': 'ˈmuːvɪŋ',
    'change': 'tʃeɪndʒ', 'changed': 'tʃeɪndʒd',
    'follow': 'ˈfɒləʊ', 'followed': 'ˈfɒləʊd',
    'answer': 'ˈɑːnsə', 'answered': 'ˈɑːnsəd',
    'remember': 'rɪˈmembə', 'remembered': 'rɪˈmembəd',
    'forget': 'fəˈɡet', 'forgot': 'fəˈɡɒt', 'forgotten': 'fəˈɡɒtn',
    'meet': 'miːt', 'met': 'met', 'meeting': 'ˈmiːtɪŋ',
    'build': 'bɪld', 'built': 'bɪlt', 'building': 'ˈbɪldɪŋ',
    'grow': 'ɡrəʊ', 'grew': 'ɡruː', 'grown': 'ɡrəʊn', 'growing': 'ˈɡrəʊɪŋ',
    'hold': 'həʊld', 'held': 'held', 'holding': 'ˈhəʊldɪŋ',
    'break': 'breɪk', 'broke': 'brəʊk', 'broken': 'ˈbrəʊkən', 'breaking': 'ˈbreɪkɪŋ',
    'catch': 'kætʃ', 'caught': 'kɔːt', 'catching': 'ˈkætʃɪŋ',
    'throw': 'θrəʊ', 'threw': 'θruː', 'thrown': 'θrəʊn', 'throwing': 'ˈθrəʊɪŋ',
    'send': 'send', 'sent': 'sent', 'sending': 'ˈsendɪŋ',
    'receive': 'rɪˈsiːv', 'received': 'rɪˈsiːvd',
    'win': 'wɪn', 'won': 'wʌn', 'winning': 'ˈwɪnɪŋ',
    'lose': 'luːz', 'lost': 'lɒst', 'losing': 'ˈluːzɪŋ',
    'study': 'ˈstʌdi', 'studied': 'ˈstʌdid', 'studying': 'ˈstʌdiɪŋ',
    'teach': 'tiːtʃ', 'taught': 'tɔːt', 'teaching': 'ˈtiːtʃɪŋ',
    'travel': 'ˈtrævəl', 'traveled': 'ˈtrævəld',
    'return': 'rɪˈtɜːn', 'returned': 'rɪˈtɜːnd',
    'stay': 'steɪ', 'stayed': 'steɪd',
    'wait': 'weɪt', 'waited': 'ˈweɪtɪd',
    'hope': 'həʊp', 'hoped': 'həʊpt',
    'wish': 'wɪʃ', 'wished': 'wɪʃt',
    'believe': 'bɪˈliːv', 'believed': 'bɪˈliːvd',
    'mean': 'miːn', 'meant': 'ment', 'meaning': 'ˈmiːnɪŋ',
    'include': 'ɪnˈkluːd', 'included': 'ɪnˈkluːdɪd',
    'appear': 'əˈpɪə', 'appeared': 'əˈpɪəd',
    'exist': 'ɪɡˈzɪst', 'existed': 'ɪɡˈzɪstɪd',
    'sit': 'sɪt', 'sat': 'sæt', 'sitting': 'ˈsɪtɪŋ',
    'stand': 'stænd', 'stood': 'stʊd', 'standing': 'ˈstændɪŋ',
    'smile': 'smaɪl', 'smiled': 'smaɪld',
    'thank': 'θæŋk', 'thanked': 'θæŋkt',
    'worry': 'ˈwʌri', 'worried': 'ˈwʌrid',
    'die': 'daɪ', 'died': 'daɪd', 'dying': 'ˈdaɪɪŋ',
    'fall': 'fɔːl', 'fell': 'fel', 'fallen': 'ˈfɔːlən', 'falling': 'ˈfɔːlɪŋ',
    'carry': 'ˈkæri', 'carried': 'ˈkærid',
    'pull': 'pʊl', 'pulled': 'pʊld', 'push': 'pʊʃ', 'pushed': 'pʊʃt',
    'man': 'mæn', 'men': 'men', 'woman': 'ˈwʊmən', 'women': 'ˈwɪmɪn',
    'child': 'tʃaɪld', 'children': 'ˈtʃɪldrən', 'people': 'ˈpiːpəl', 'person': 'ˈpɜːsən',
    'school': 'skuːl', 'time': 'taɪm', 'day': 'deɪ', 'year': 'jɪə', 'world': 'wɜːld',
    'life': 'laɪf', 'hand': 'hænd', 'part': 'pɑːt', 'eye': 'aɪ', 'place': 'pleɪs',
    'case': 'keɪs', 'point': 'pɔɪnt', 'government': 'ˈɡʌvənmənt', 'company': 'ˈkʌmpəni',
    'number': 'ˈnʌmbə', 'group': 'ɡruːp', 'problem': 'ˈprɒbləm', 'fact': 'fækt',
    'home': 'həʊm', 'water': 'ˈwɔːtə', 'room': 'ruːm', 'mother': 'ˈmʌðə',
    'father': 'ˈfɑːðə', 'friend': 'frend', 'book': 'bʊk', 'word': 'wɜːd',
    'line': 'laɪn', 'city': 'ˈsɪti', 'family': 'ˈfæməli', 'student': 'ˈstjuːdənt',
    'teacher': 'ˈtiːtʃə', 'country': 'ˈkʌntri', 'money': 'ˈmʌni', 'food': 'fuːd',
    'house': 'haʊs', 'car': 'kɑː', 'door': 'dɔː', 'name': 'neɪm', 'head': 'hed',
    'face': 'feɪs', 'night': 'naɪt', 'morning': 'ˈmɔːnɪŋ', 'evening': 'ˈiːvnɪŋ',
    'week': 'wiːk', 'month': 'mʌnθ', 'hour': 'ˈaʊə', 'minute': 'ˈmɪnɪt',
    'idea': 'aɪˈdɪə', 'story': 'ˈstɔːri', 'question': 'ˈkwestʃən', 'example': 'ɪɡˈzɑːmpəl',
    'result': 'rɪˈzʌlt', 'light': 'laɪt', 'fire': 'ˈfaɪə', 'earth': 'ɜːθ',
    'sun': 'sʌn', 'moon': 'muːn', 'star': 'stɑː', 'tree': 'triː', 'animal': 'ˈænɪməl',
    'dog': 'dɒɡ', 'cat': 'kæt', 'bird': 'bɜːd', 'fish': 'fɪʃ', 'horse': 'hɔːs',
    'road': 'rəʊd', 'street': 'striːt', 'train': 'treɪn', 'bus': 'bʌs',
    'plane': 'pleɪn', 'phone': 'fəʊn', 'computer': 'kəmˈpjuːtə', 'internet': 'ˈɪntənet',
    'language': 'ˈlæŋɡwɪdʒ', 'music': 'ˈmjuːzɪk', 'art': 'ɑːt', 'science': 'ˈsaɪəns',
    'math': 'mæθ', 'history': 'ˈhɪstəri', 'health': 'helθ', 'job': 'dʒɒb',
    'business': 'ˈbɪznəs', 'market': 'ˈmɑːkɪt', 'shop': 'ʃɒp', 'store': 'stɔː',
    'hospital': 'ˈhɒspɪtl', 'office': 'ˈɒfɪs', 'class': 'klɑːs', 'lesson': 'ˈlesən',
    'test': 'test', 'exam': 'ɪɡˈzæm', 'grade': 'ɡreɪd', 'letter': 'ˈletə',
    'email': 'ˈiːmeɪl', 'news': 'njuːz', 'information': 'ˌɪnfəˈmeɪʃən', 'message': 'ˈmesɪdʒ',
    'picture': 'ˈpɪktʃə', 'color': 'ˈkʌlə', 'colour': 'ˈkʌlə', 'size': 'saɪz',
    'shape': 'ʃeɪp', 'side': 'saɪd', 'end': 'end', 'top': 'tɒp', 'bottom': 'ˈbɒtəm',
    'front': 'frʌnt', 'back': 'bæk', 'center': 'ˈsentə', 'centre': 'ˈsentə',
    'inside': 'ɪnˈsaɪd', 'outside': 'ˌaʊtˈsaɪd', 'thing': 'θɪŋ', 'way': 'weɪ',
    'good': 'ɡʊd', 'bad': 'bæd', 'big': 'bɪɡ', 'small': 'smɔːl', 'long': 'lɒŋ',
    'short': 'ʃɔːt', 'high': 'haɪ', 'low': 'ləʊ', 'old': 'əʊld', 'new': 'njuː',
    'young': 'jʌŋ', 'hot': 'hɒt', 'cold': 'kəʊld', 'warm': 'wɔːm', 'cool': 'kuːl',
    'happy': 'ˈhæpi', 'sad': 'sæd', 'angry': 'ˈæŋɡri', 'tired': 'ˈtaɪəd',
    'hungry': 'ˈhʌŋɡri', 'full': 'fʊl', 'empty': 'ˈempti', 'clean': 'kliːn',
    'dirty': 'ˈdɜːti', 'easy': 'ˈiːzi', 'hard': 'hɑːd', 'difficult': 'ˈdɪfɪkəlt',
    'fast': 'fɑːst', 'slow': 'sləʊ', 'early': 'ˈɜːli', 'late': 'leɪt', 'rich': 'rɪtʃ',
    'poor': 'pʊə', 'free': 'friː', 'busy': 'ˈbɪzi', 'quiet': 'ˈkwaɪət', 'loud': 'laʊd',
    'beautiful': 'ˈbjuːtɪfəl', 'strong': 'strɒŋ', 'weak': 'wiːk', 'heavy': 'ˈhevi',
    'red': 'red', 'blue': 'bluː', 'green': 'ɡriːn', 'yellow': 'ˈjeləʊ', 'black': 'blæk',
    'white': 'waɪt', 'dark': 'dɑːk', 'bright': 'braɪt', 'same': 'seɪm',
    'different': 'ˈdɪfrənt', 'right': 'raɪt', 'wrong': 'rɒŋ', 'true': 'truː',
    'false': 'fɔːls', 'important': 'ɪmˈpɔːtənt', 'possible': 'ˈpɒsəbəl', 'real': 'rɪəl',
    'strange': 'streɪndʒ', 'normal': 'ˈnɔːməl', 'special': 'ˈspeʃəl', 'common': 'ˈkɒmən',
    'main': 'meɪn', 'total': 'ˈtəʊtl', 'final': 'ˈfaɪnl', 'next': 'nekst',
    'last': 'lɑːst', 'first': 'fɜːst', 'second': 'ˈsekənd', 'little': 'ˈlɪtl',
    'few': 'fjuː', 'many': 'ˈmeni', 'much': 'mʌtʃ', 'more': 'mɔː', 'most': 'məʊst',
    'less': 'les', 'least': 'liːst', 'enough': 'ɪˈnʌf', 'own': 'əʊn', 'great': 'ɡreɪt',
    'large': 'lɑːdʒ', 'clear': 'klɪə', 'kind': 'kaɪnd', 'able': 'ˈeɪbəl',
    'ready': 'ˈredi', 'sure': 'ʃʊə', 'available': 'əˈveɪləbəl', 'public': 'ˈpʌblɪk',
    'private': 'ˈpraɪvət',
    'now': 'naʊ', 'then': 'ðen', 'here': 'hɪə', 'there': 'ðeə', 'today': 'təˈdeɪ',
    'tomorrow': 'təˈmɒrəʊ', 'yesterday': 'ˈjestədeɪ', 'always': 'ˈɔːlweɪz',
    'never': 'ˈnevə', 'often': 'ˈɒfən', 'sometimes': 'ˈsʌmtaɪmz', 'usually': 'ˈjuːʒuəli',
    'soon': 'suːn', 'already': 'ɔːlˈredi', 'just': 'dʒʌst', 'very': 'ˈveri',
    'quite': 'kwaɪt', 'really': 'ˈrɪəli', 'almost': 'ˈɔːlməʊst', 'even': 'ˈiːvən',
    'only': 'ˈəʊnli', 'again': 'əˈɡen', 'still': 'stɪl', 'away': 'əˈweɪ',
    'well': 'wel', 'badly': 'ˈbædli', 'quickly': 'ˈkwɪkli', 'slowly': 'ˈsləʊli',
    'together': 'təˈɡeðə', 'perhaps': 'pəˈhæps', 'maybe': 'ˈmeɪbi',
    'certainly': 'ˈsɜːtnli', 'probably': 'ˈprɒbəbli', 'instead': 'ɪnˈsted', 'forward': 'ˈfɔːwəd'
  };

  function normalize(w) {
    return (w || '').trim().toLowerCase()
      .replace(/^[‘’'"`()\[\]{}<>„"“”.,!?;:…—\-]+/, '')
      .replace(/[‘’'"`()\[\]{}<>„"“”.,!?;:…—\-]+$/, '');
  }

  // 常规变形回退：处理复数/三单 -s/-es、过去 -ed、现在分词 -ing、副词 -ly、ies→y
  function baseForm(s) {
    if (MAP[s]) return s;
    var t = s, m;
    if ((m = /^(.+?)(ies)$/.exec(t)) && m[1].length >= 2) { if (MAP[m[1] + 'y']) return m[1] + 'y'; }
    else if ((m = /^(.+?)(es)$/.exec(t)) && m[1].length >= 2) { if (MAP[m[1]]) return m[1]; }
    else if ((m = /^(.+?)(s)$/.exec(t)) && m[1].length >= 2) { if (MAP[m[1]]) return m[1]; }
    if ((m = /^(.+?)(ing)$/.exec(t)) && m[1].length >= 3) { if (MAP[m[1]]) return m[1]; if (MAP[m[1] + 'e']) return m[1] + 'e'; }
    if ((m = /^(.+?)(ed)$/.exec(t)) && m[1].length >= 2) {
      if (MAP[m[1]]) return m[1];
      if (MAP[m[1] + 'e']) return m[1] + 'e';
      if ((/^(.+?)(i)$/.exec(m[1])) && MAP[RegExp.$1 + 'y']) return RegExp.$1 + 'y';
    }
    if ((m = /^(.+?)(ly)$/.exec(t)) && m[1].length >= 2) { if (MAP[m[1]]) return m[1]; }
    return null;
  }

  function lookup(raw) {
    var w = normalize(raw);
    if (!w) return null;
    var zh = MAP[w];
    var ph = PHON[w] || null;
    if (!zh) {
      var base = baseForm(w);
      if (base && MAP[base]) { zh = MAP[base]; if (!ph) ph = PHON[base] || null; }
    }
    if (!zh) return null;
    return { word: w, zh: zh, ph: ph, local: true };
  }

  // 翻译快路径：单基础词直接返回；短语仅当全部 token 皆为基础词才本地拼接（避免语境错误），否则返回 null 交 AI
  function translateText(text) {
    if (!text) return null;
    var t = (text + '').trim();
    if (/\s/.test(t) || /[，,。.!?；;：:]/.test(t)) {
      var toks = t.split(/[^a-zA-Z']+/).filter(Boolean);
      if (!toks.length) return null;
      var out = [];
      for (var i = 0; i < toks.length; i++) {
        var r = lookup(toks[i]);
        if (!r) return null;
        out.push(r.zh);
      }
      return out.join('');
    }
    var single = lookup(t);
    return single ? single.zh : null;
  }

  Mobile.LocalLexicon = {
    map: MAP,
    lookup: lookup,
    translateText: translateText,
    normalize: normalize
  };
})(window);
