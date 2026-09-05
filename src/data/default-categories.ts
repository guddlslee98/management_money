/**
 * 기본 카테고리(대분류·소분류)와 기본 자동 분류 규칙.
 *
 * 설계 근거
 * - 국내 가계부 앱(뱅크샐러드·토스·편한가계부·위플·카카오페이·네이버페이)의 공통 대분류
 *   (식비 / 카페·간식 / 생활·마트 / 쇼핑 / 뷰티·미용 / 교통 / 주거·통신 / 의료·건강 / 문화·여가 /
 *   교육 / 경조사·선물 / 육아 / 반려동물 / 금융·보험 / 기타)를 14개로 압축했다.
 * - 통계청 가계동향조사 소비지출 12대 비목(식료품·비주류음료, 주류·담배, 의류·신발, 주거·수도·광열,
 *   가정용품·가사서비스, 보건, 교통, 통신, 오락·문화, 교육, 음식·숙박, 기타상품·서비스)과
 *   교차 검증했다. 통계청이 여행(단체여행)을 오락·문화에 두는 것처럼 여행은 여가·여행 아래 소분류로 둔다.
 *
 * id 규칙
 * - 대분류: `food`, `income.salary` 처럼 안정적인 ASCII slug.
 * - 소분류: `<parentId>.<child>` (예: `food.restaurant`, `income.salary.bonus`).
 *
 * 색상
 * - 대분류 색은 OKLCH 색상환에서 인접 색끼리 명도를 번갈아 배치해(L≈0.55/0.65) 서로 구분되게 했고,
 *   #f7f7f8(라이트)·#0f1115(다크) 배경 모두에서 대비 3:1 이상, 대분류끼리 CIEDE2000 ≥ 14 이다.
 *   소분류는 부모 색을 그대로 쓴다.
 *
 * 규칙(DEFAULT_RULES)
 * - `pattern`은 `|`로 구분한 키워드 목록. 분류기는 거래처/메모에서 공백을 제거하고 대소문자를 무시한
 *   부분 문자열 매칭을 하므로, 키워드에도 공백을 넣지 않는다 (예: `유튜브프리미엄`, `apple.com/bill`).
 * - 브랜드처럼 구체적인 키워드는 높은 priority(100), 일반 명사는 낮은 priority(40~60)를 준다.
 *   다른 규칙의 키워드를 포함하는 키워드(예: `쿠팡이츠` ⊃ `쿠팡`)는 그 규칙보다 높은 priority(110)로 두어
 *   더 구체적인 분류가 이기게 한다. (default-categories.test.ts 가 이 불변식을 검사한다.)
 */
import type { Category, ClassifyRule } from '../db/types'

export type DefaultRule = Pick<ClassifyRule, 'pattern' | 'categoryId' | 'priority'>

/* ------------------------------------------------------------------ */
/* 카테고리 정의                                                         */
/* ------------------------------------------------------------------ */

type ChildSpec = readonly [id: string, name: string, emoji: string]

interface ParentSpec {
  readonly id: string
  readonly name: string
  readonly emoji: string
  readonly color: string
  readonly children: readonly ChildSpec[]
}

const EXPENSE = [
  {
    id: 'food',
    name: '식비',
    emoji: '🍚',
    color: '#c53637',
    children: [
      ['restaurant', '식당·외식', '🍽️'],
      ['delivery', '배달', '🛵'],
      ['fastfood', '치킨·피자·버거', '🍕'],
      ['alcohol', '술·회식', '🍻'],
      ['instant', '도시락·간편식', '🍱'],
    ],
  },
  {
    id: 'cafe',
    name: '카페·간식',
    emoji: '☕',
    color: '#94582a',
    children: [
      ['coffee', '커피', '☕'],
      ['bakery', '베이커리·디저트', '🍰'],
      ['snack', '음료·간식', '🧋'],
    ],
  },
  {
    id: 'living',
    name: '생활·마트',
    emoji: '🛒',
    color: '#548108',
    children: [
      ['convenience', '편의점', '🏪'],
      ['mart', '마트·장보기', '🛒'],
      ['supplies', '생활용품', '🧴'],
      ['service', '세탁·택배·서비스', '🧺'],
    ],
  },
  {
    id: 'shopping',
    name: '쇼핑',
    emoji: '🛍️',
    color: '#d35bb1',
    children: [
      ['online', '온라인쇼핑', '📦'],
      ['clothes', '의류·패션', '👕'],
      ['accessory', '신발·가방·잡화', '👟'],
      ['electronics', '가전·디지털', '📱'],
      ['home', '가구·인테리어', '🛋️'],
      ['dept', '백화점·아울렛', '🏬'],
    ],
  },
  {
    id: 'beauty',
    name: '뷰티·미용',
    emoji: '💄',
    color: '#914bbe',
    children: [
      ['hair', '미용실·헤어', '💇'],
      ['cosmetics', '화장품', '💄'],
      ['care', '네일·피부관리', '💅'],
    ],
  },
  {
    id: 'transport',
    name: '교통·자동차',
    emoji: '🚗',
    color: '#0274c7',
    children: [
      ['public', '대중교통', '🚇'],
      ['taxi', '택시', '🚕'],
      ['rail', '기차·고속버스', '🚄'],
      ['fuel', '주유·충전', '⛽'],
      ['parking', '주차·통행료', '🅿️'],
      ['maintenance', '정비·세차', '🔧'],
      ['rental', '렌터카·카셰어링', '🚙'],
    ],
  },
  {
    id: 'housing',
    name: '주거·공과금',
    emoji: '🏠',
    color: '#00837e',
    children: [
      ['rent', '월세·관리비', '🏠'],
      ['electric', '전기요금', '💡'],
      ['gas', '가스요금', '🔥'],
      ['water', '수도요금', '🚰'],
      ['repair', '수리·이사', '🛠️'],
    ],
  },
  {
    id: 'telecom',
    name: '통신·구독',
    emoji: '📡',
    color: '#7d7df9',
    children: [
      ['mobile', '휴대폰', '📱'],
      ['internet', '인터넷·TV', '📺'],
      ['ott', 'OTT·음악', '🎧'],
      ['software', '앱·소프트웨어', '💻'],
      ['membership', '멤버십', '🎫'],
    ],
  },
  {
    id: 'health',
    name: '의료·건강',
    emoji: '🏥',
    color: '#049863',
    children: [
      ['hospital', '병원·의원', '🏥'],
      ['pharmacy', '약국', '💊'],
      ['dental', '치과·한의원', '🦷'],
      ['fitness', '운동·헬스', '🏋️'],
      ['supplement', '영양제·건강식품', '🌿'],
    ],
  },
  {
    id: 'leisure',
    name: '여가·여행',
    emoji: '🎬',
    color: '#158eab',
    children: [
      ['movie', '영화·공연', '🎬'],
      ['book', '도서', '📖'],
      ['game', '게임', '🎮'],
      ['hobby', '취미·레저', '⛳'],
      ['social', '데이트·모임', '🥂'],
      ['flight', '항공', '✈️'],
      ['stay', '숙박', '🏨'],
      ['travel', '여행경비', '🧳'],
    ],
  },
  {
    id: 'education',
    name: '교육',
    emoji: '📚',
    color: '#a48610',
    children: [
      ['academy', '학원·과외', '🏫'],
      ['online', '온라인강의', '🖥️'],
      ['books', '교재·문구', '✏️'],
      ['exam', '자격증·시험', '📝'],
      ['tuition', '등록금·수강료', '🎓'],
    ],
  },
  {
    id: 'family',
    name: '가족·경조사',
    emoji: '🎁',
    color: '#de6907',
    children: [
      ['ceremony', '경조사', '💐'],
      ['gift', '선물', '🎁'],
      ['allowance', '용돈·부모님', '🧧'],
      ['kids', '육아·자녀', '🧸'],
      ['pet', '반려동물', '🐾'],
    ],
  },
  {
    id: 'finance',
    name: '금융·보험',
    emoji: '🏦',
    color: '#5b627d',
    children: [
      ['insurance', '보험', '🛡️'],
      ['tax', '세금·공과', '🧾'],
      ['fee', '수수료', '💳'],
      ['interest', '대출이자·상환', '🏦'],
    ],
  },
  {
    id: 'etc',
    name: '기타',
    emoji: '📦',
    color: '#7c7368',
    children: [
      ['donation', '기부·후원', '❤️'],
      ['penalty', '벌금·과태료', '🚨'],
      ['misc', '기타', '📦'],
    ],
  },
] as const satisfies readonly ParentSpec[]

const INCOME = [
  {
    id: 'income.salary',
    name: '급여',
    emoji: '💰',
    color: '#049863',
    children: [
      ['monthly', '월급', '💰'],
      ['bonus', '상여·성과급', '🎉'],
      ['allowance', '수당', '➕'],
    ],
  },
  {
    id: 'income.business',
    name: '사업소득',
    emoji: '🏪',
    color: '#0274c7',
    children: [
      ['sales', '매출', '🧾'],
      ['freelance', '프리랜서·외주', '🧑‍💻'],
    ],
  },
  {
    id: 'income.allowance',
    name: '용돈',
    emoji: '🧧',
    color: '#de6907',
    children: [],
  },
  {
    id: 'income.investment',
    name: '이자·배당',
    emoji: '📈',
    color: '#7d7df9',
    children: [
      ['interest', '예금이자', '🏦'],
      ['dividend', '배당금', '📈'],
      ['gain', '투자수익', '💹'],
    ],
  },
  {
    id: 'income.side',
    name: '부수입',
    emoji: '🪙',
    color: '#d35bb1',
    children: [
      ['resale', '중고거래', '🔄'],
      ['reward', '앱테크·리워드', '🎯'],
      ['gig', '부업·알바', '🛠️'],
    ],
  },
  {
    id: 'income.refund',
    name: '환급·정산',
    emoji: '🔁',
    color: '#00837e',
    children: [
      ['tax', '세금환급', '🧾'],
      ['cashback', '캐시백·포인트', '💸'],
      ['settlement', '더치페이·정산', '🤝'],
      ['insurance', '보험금', '🛡️'],
    ],
  },
  {
    id: 'income.etc',
    name: '기타수입',
    emoji: '📥',
    color: '#5b627d',
    children: [],
  },
] as const satisfies readonly ParentSpec[]

/* 규칙의 categoryId를 컴파일 타임에 검증하기 위한 id 유니온 */
type ParentIdOf<T> = T extends { readonly id: infer P extends string } ? P : never
type ChildIdOf<T> = T extends { readonly id: infer P extends string; readonly children: infer Ch }
  ? Ch extends readonly []
    ? never
    : Ch extends readonly (readonly [infer C extends string, ...unknown[]])[]
      ? `${P}.${C}`
      : never
  : never
type ExpenseSpec = (typeof EXPENSE)[number]
type IncomeSpec = (typeof INCOME)[number]
export type DefaultCategoryId =
  | ParentIdOf<ExpenseSpec>
  | ChildIdOf<ExpenseSpec>
  | ParentIdOf<IncomeSpec>
  | ChildIdOf<IncomeSpec>

function build(kind: Category['kind'], specs: readonly ParentSpec[], start: number): Category[] {
  const out: Category[] = []
  let sortOrder = start
  for (const p of specs) {
    out.push({
      id: p.id,
      kind,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      parentId: null,
      sortOrder: sortOrder++,
      isArchived: false,
    })
    for (const [childId, name, emoji] of p.children) {
      out.push({
        id: `${p.id}.${childId}`,
        kind,
        name,
        emoji,
        color: p.color,
        parentId: p.id,
        sortOrder: sortOrder++,
        isArchived: false,
      })
    }
  }
  return out
}

const expenseCategories = build('expense', EXPENSE, 0)
const incomeCategories = build('income', INCOME, expenseCategories.length)

/** 대분류 + 소분류. 배열 순서 = sortOrder 순서 */
export const DEFAULT_CATEGORIES: Category[] = [...expenseCategories, ...incomeCategories]

/* ------------------------------------------------------------------ */
/* 자동 분류 규칙                                                        */
/* ------------------------------------------------------------------ */

/** 다른 브랜드 키워드를 포함하는 더 구체적인 브랜드 (예: 쿠팡이츠 ⊃ 쿠팡) */
const OVERRIDE = 110
/** 프랜차이즈·브랜드·서비스명 */
const BRAND = 100
/** 업종을 특정하는 일반 명사 (치과, 약국, 축의금 …) */
const SPECIFIC = 60
/** 일반 명사 (식당, 병원, 택시 …) */
const GENERIC = 50
/** 매우 일반적인 단어 (마트, 카페, 버스 …) — 다른 규칙이 없을 때만 */
const WEAK = 40

function rule(pattern: string, categoryId: DefaultCategoryId, priority: number): DefaultRule {
  return { pattern, categoryId, priority }
}

export const DEFAULT_RULES: DefaultRule[] = [
  /* ---------- 식비 ---------- */
  rule('아웃백|빕스|애슐리|본죽|죽이야기|한촌설렁탕|명륜진사갈비|하남돼지집|놀부|원할머니|김밥천국|신전떡볶이|엽기떡볶이|홍콩반점|역전우동', 'food.restaurant', BRAND),
  rule('식당|밥집|백반|정식집|국밥|한식|중식|일식|양식|분식|김밥|떡볶이|순대|만두|국수|칼국수|냉면|막국수|쌀국수', 'food.restaurant', GENERIC),
  rule('고기|삼겹살|갈비|곱창|족발|보쌈|횟집|회센터|초밥|스시|샤브|양꼬치|마라탕|쭈꾸미|낙지|찌개|해장국|설렁탕|감자탕|순두부', 'food.restaurant', GENERIC),
  rule('돈까스|돈가스|짬뽕|짜장|중국집|반점|덮밥|라멘|우동|소바|파스타|타코|브런치|뷔페|레스토랑|restaurant|다이닝|그릴|포케|샐러드|점심|저녁식사', 'food.restaurant', GENERIC),
  rule('배달의민족|배민|요기요|땡겨요|딜리버리', 'food.delivery', BRAND),
  rule('쿠팡이츠|위메프오', 'food.delivery', OVERRIDE),
  rule('배달|delivery', 'food.delivery', GENERIC),
  rule('맥도날드|mcdonald|버거킹|burgerking|롯데리아|맘스터치|서브웨이|subway|kfc|쉐이크쉑|shakeshack|파이브가이즈|프랭크버거', 'food.fastfood', BRAND),
  rule('노브랜드버거', 'food.fastfood', OVERRIDE),
  rule('교촌|bbq|비비큐|bhc|굽네|페리카나|네네치킨|처갓집|60계|자담치킨|푸라닭|호식이|멕시카나|지코바', 'food.fastfood', BRAND),
  rule('도미노|파파존스|피자헛|피자스쿨|피자알볼로|피자마루|반올림피자|고피자|미스터피자|청년피자', 'food.fastfood', BRAND),
  rule('버거|햄버거|치킨|피자|치맥', 'food.fastfood', GENERIC),
  rule('호프|주점|포차|이자카야|와인바|호프집|생맥|막걸리|위스키|칵테일|하이볼|양주|주류', 'food.alcohol', BRAND),
  rule('술집|와인|맥주|소주|펍|pub|회식|안주', 'food.alcohol', GENERIC),
  rule('한솥|샐러디|삼각김밥|밀키트|컵밥|간편식|hmr', 'food.instant', BRAND),
  rule('도시락', 'food.instant', SPECIFIC),

  /* ---------- 카페·간식 ---------- */
  rule('스타벅스|starbucks|투썸|이디야|ediya|메가커피|메가mgc|mgc커피|컴포즈|빽다방|폴바셋|paulbassett|할리스|hollys|커피빈|coffeebean', 'cafe.coffee', BRAND),
  rule('탐앤탐스|엔제리너스|파스쿠찌|드롭탑|더벤티|커피베이|블루보틀|bluebottle|매머드커피|카페베네|테라로사|앤트러사이트|커피스미스|하삼동', 'cafe.coffee', BRAND),
  rule('카페|커피|coffee|cafe|caffe|다방|에스프레소|라떼', 'cafe.coffee', WEAK),
  rule('파리바게뜨|파리바게트|파리크라상|뚜레쥬르|성심당|던킨|dunkin|크리스피크림|배스킨라빈스|baskin|나뚜루|설빙|디저트39|앤티앤스|삼송빵집|노티드|런던베이글|타르틴', 'cafe.bakery', BRAND),
  rule('베이커리|bakery|빵집|제과|제빵|케이크|마카롱|도넛|와플|크로플|아이스크림|디저트|타르트|베이글', 'cafe.bakery', GENERIC),
  rule('공차|gongcha|쥬씨|스무디킹|요아정|팔공티|마시그래이|오가다|탕후루', 'cafe.snack', BRAND),
  rule('버블티|밀크티|간식|과자|음료수|주스|스무디|젤리|요거트', 'cafe.snack', GENERIC),

  /* ---------- 생활·마트 ---------- */
  rule('gs25|씨유|세븐일레븐|7-eleven|7eleven|미니스톱|이마트24', 'living.convenience', OVERRIDE),
  rule('cu', 'living.convenience', BRAND - 10),
  rule('편의점|담배', 'living.convenience', GENERIC),
  rule('이마트|홈플러스|롯데마트|코스트코|costco|트레이더스|하나로마트|하나로클럽|농협하나로|노브랜드|킴스클럽|메가마트|롯데슈퍼|gs더프레시|gs수퍼|초록마을|올가', 'living.mart', BRAND),
  rule('마켓컬리|컬리|kurly|오아시스마켓|헬로네이처', 'living.mart', BRAND),
  rule('쿠팡프레시|이마트몰|홈플러스온라인|롯데마트몰', 'living.mart', OVERRIDE),
  rule('마트|슈퍼|수퍼|식자재|정육|청과|축산|농산물|수산|반찬|식료품|장보기|우유|계란', 'living.mart', WEAK),
  rule('다이소|무인양품|muji|모던하우스|jaju', 'living.supplies', BRAND),
  rule('생활용품|세제|물티슈|휴지|주방용품|욕실용품|잡화', 'living.supplies', GENERIC),
  rule('크린토피아|런드리고|세탁특공대|워시스왓|청소연구소|우체국|편의점택배|cj대한통운|롯데택배|한진택배|우체국택배', 'living.service', BRAND),
  rule('세탁|세탁소|드라이클리닝|수선|택배|배송비|우편|등기|열쇠|청소|가사도우미|방역', 'living.service', GENERIC),

  /* ---------- 쇼핑 ---------- */
  rule('쿠팡|coupang|네이버페이|npay|네이버쇼핑|스마트스토어|지마켓|g마켓|gmarket|옥션|auction|11번가|위메프|티몬|알리익스프레스|aliexpress|알리바바|테무|temu|쉬인|shein', 'shopping.online', BRAND),
  rule('ssg|신세계몰|롯데온|lotteon|카카오쇼핑|카카오톡쇼핑|올웨이즈|cj온스타일|gs샵|현대홈쇼핑|롯데홈쇼핑|nc홈쇼핑|아마존|amazon|이베이|ebay|큐텐|qoo10', 'shopping.online', BRAND),
  rule('인터파크쇼핑', 'shopping.online', OVERRIDE),
  rule('홈쇼핑|온라인쇼핑|쇼핑몰', 'shopping.online', GENERIC),
  rule('무신사|musinsa|29cm|지그재그|에이블리|브랜디|w컨셉|kream|유니클로|uniqlo|자라리테일|zara|h&m|나이키|nike|아디다스|adidas|뉴발란스|탑텐|스파오|에잇세컨즈|미쏘|지오다노|폴로|무탠다드|르무통|마리떼|노스페이스|디스커버리', 'shopping.clothes', BRAND),
  rule('의류|패션|옷가게|티셔츠|원피스|자켓|패딩|속옷|양말', 'shopping.clothes', GENERIC),
  rule('abc마트|슈마커|레스모아|크록스|crocs|다비치안경|룩옵티컬|판도라|골든듀|스와로브스키', 'shopping.accessory', BRAND),
  rule('신발|운동화|구두|가방|지갑|안경|아이웨어|렌즈|악세사리|액세서리|주얼리|시계|모자', 'shopping.accessory', GENERIC),
  rule('하이마트|전자랜드|애플스토어|applestore|삼성디지털프라자|삼성스토어|삼성닷컴|컴퓨존|다나와|일렉트로마트|프리스비|frisbee|샤오미|xiaomi|다이슨|dyson', 'shopping.electronics', OVERRIDE),
  rule('가전|전자제품|노트북|아이폰|갤럭시|이어폰|헤드폰|키보드|마우스|모니터|태블릿|충전기', 'shopping.electronics', GENERIC),
  rule('오늘의집|이케아|ikea|한샘|일룸|시디즈|리바트|데스커|까사미아', 'shopping.home', BRAND),
  rule('자라홈|zarahome', 'shopping.home', OVERRIDE),
  rule('가구|인테리어|침구|이불|커튼|조명|수납|홈데코', 'shopping.home', GENERIC),
  rule('백화점|아울렛|갤러리아|더현대|ak플라자|타임스퀘어|스타필드|ifc몰|코엑스몰', 'shopping.dept', SPECIFIC),

  /* ---------- 뷰티·미용 ---------- */
  rule('준오헤어|박승철|이철헤어커커|리안헤어|살롱드|블로우', 'beauty.hair', BRAND),
  rule('미용실|헤어|살롱|이발|바버|이용원', 'beauty.hair', GENERIC),
  rule('올리브영|oliveyoung|이니스프리|아리따움|시코르|세포라|sephora|미샤|에뛰드|더페이스샵|아모레|롭스|랄라블라|토니모리|클리오|조말론|러쉬|lush', 'beauty.cosmetics', BRAND),
  rule('무신사뷰티', 'beauty.cosmetics', OVERRIDE),
  rule('화장품|스킨케어|코스메틱|향수|선크림|립스틱', 'beauty.cosmetics', GENERIC),
  rule('네일|왁싱|피부관리|에스테틱|속눈썹|마사지|태닝|메이크업|사우나|찜질방|목욕탕|두피관리', 'beauty.care', GENERIC),

  /* ---------- 교통·자동차 ---------- */
  rule('티머니|tmoney|캐시비|cashbee|서울교통공사|따릉이|킥고잉|지쿠터|스윙|swing|타슈|씽씽', 'transport.public', BRAND),
  rule('지하철|버스|교통카드|후불교통|대중교통|마을버스|광역버스|킥보드|공유자전거', 'transport.public', GENERIC),
  rule('카카오택시|카카오t|kakaot|타다|tada|우버|uber|아이엠택시|i.m택시|온다택시|마카롱택시', 'transport.taxi', BRAND),
  rule('카카오t대리|카카오대리', 'transport.taxi', OVERRIDE),
  rule('택시|taxi|대리운전|대리비', 'transport.taxi', GENERIC),
  rule('코레일|korail|레츠코레일|ktx|srt|kobus|버스타고|티머니고|고속버스|시외버스|고속철도', 'transport.rail', OVERRIDE),
  rule('기차|열차|철도|터미널|승차권', 'transport.rail', GENERIC),
  rule('gs칼텍스|sk에너지|s-oil|에스오일|soil|현대오일뱅크|오일뱅크|알뜰주유소|sk엔크린|만복주유소|ev충전|전기차충전|chargev|환경부충전|에버온|파워큐브', 'transport.fuel', BRAND),
  rule('주유|주유소|충전소|경유|휘발유|lpg', 'transport.fuel', GENERIC),
  rule('하이패스|hipass|한국도로공사|모두의주차장|아이파킹|파킹클라우드|카카오t주차|카카오주차', 'transport.parking', OVERRIDE),
  rule('주차|파킹|통행료|톨게이트|공영주차장|주차장', 'transport.parking', GENERIC),
  rule('블루핸즈|오토큐|스피드메이트|타이어뱅크|현대자동차|기아오토큐|한국타이어|금호타이어|넥센타이어|카닥', 'transport.maintenance', BRAND),
  rule('정비|카센터|타이어|세차|오일교환|엔진오일|자동차검사|자동차수리|정비소|워셔액', 'transport.maintenance', GENERIC),
  rule('쏘카|socar|그린카|greencar|투루카|피플카|롯데렌터카|sk렌터카|카모아', 'transport.rental', BRAND),
  rule('렌터카|렌트카|렌트비|카셰어링', 'transport.rental', GENERIC),

  /* ---------- 주거·공과금 ---------- */
  rule('월세|관리비|아파트관리비|임대료|주거비|월세이체|사택|기숙사비', 'housing.rent', GENERIC),
  rule('한국전력|한전|kepco|전기요금|전기세|전기료', 'housing.electric', BRAND),
  rule('서울도시가스|경동도시가스|인천도시가스|예스코|코원에너지|대성에너지|jb주식회사|해양에너지|영남에너지|도시가스|가스요금|가스비|가스공사', 'housing.gas', BRAND),
  rule('아리수|상수도|수도요금|수도세|수도료|k-water|수도사업소|상하수도|수자원공사', 'housing.water', BRAND),
  rule('포장이사|이사비|이삿짐|사다리차|도배|장판|집수리|수리비|보일러|누수|배관|인테리어공사|리모델링|설치비', 'housing.repair', GENERIC),

  /* ---------- 통신·구독 ---------- */
  rule('skt|sk텔레콤|케이티|lgu+|lg유플러스|엘지유플러스|유플러스|알뜰폰|ktm모바일|kt엠모바일|헬로모바일|세븐모바일|프리티|모빙|아이즈모바일|스노우맨|리브모바일|토스모바일', 'telecom.mobile', BRAND),
  rule('kt', 'telecom.mobile', WEAK),
  rule('휴대폰요금|통신요금|통신비|휴대폰|핸드폰', 'telecom.mobile', GENERIC),
  rule('sk브로드밴드|skb|skbroadband|브로드밴드|lg헬로비전|헬로비전|딜라이브|kt인터넷|kt올레|olleh|기가인터넷|btv|u+tv|지니tv', 'telecom.internet', BRAND),
  rule('인터넷요금|tv수신료|kbs수신료|iptv|셋톱박스|유선방송|케이블tv|와이파이', 'telecom.internet', GENERIC),
  rule('넷플릭스|netflix|유튜브|youtube|디즈니플러스|디즈니+|disney|티빙|tving|웨이브|wavve|왓챠|watcha|스포티파이|spotify|멜론|지니뮤직|bugs|애플뮤직|applemusic|유튜브뮤직|밀리의서재|크런치롤|라프텔|애플tv|appletv', 'telecom.ott', BRAND),
  rule('쿠팡플레이|리디셀렉트|네이버시리즈온', 'telecom.ott', OVERRIDE),
  rule('apple.com/bill|itunes|구글플레이|googleplay|chatgpt|openai|오픈ai|anthropic|claude.ai|노션|notion|어도비|adobe|microsoft|마이크로소프트|드롭박스|dropbox|아이클라우드|icloud|github|figma|피그마|canva|캔바|원드라이브|onedrive|네이버mybox|마이박스|제미나이|gemini|perplexity|cursor', 'telecom.software', BRAND),
  rule('구글|google|애플|apple', 'telecom.software', GENERIC),
  rule('쿠팡와우|와우멤버십|네이버플러스|배민클럽|컬리멤버스|요기패스|신세계유니버스|유니버스클럽|스마일클럽|아마존프라임|amazonprime|토스프라임', 'telecom.membership', OVERRIDE),
  rule('멤버십|정기결제|정기구독|구독료|월정액', 'telecom.membership', GENERIC),

  /* ---------- 의료·건강 ---------- */
  rule('안과|피부과|정형외과|내과|이비인후과|소아과|산부인과|비뇨기과|정신건강의학과|신경과|성형외과|가정의학과|재활의학과|건강검진|검진센터|대학병원|응급실|종합병원|보건소', 'health.hospital', SPECIFIC),
  rule('병원|의원|메디컬|클리닉|진료비|진료', 'health.hospital', GENERIC),
  rule('약국|온누리약국|처방약|조제', 'health.pharmacy', SPECIFIC),
  rule('치과|한의원|한방병원|한약|교정치과|임플란트|스케일링|치아교정', 'health.dental', SPECIFIC),
  rule('헬스|피트니스|fitness|필라테스|pilates|요가|yoga|수영장|크로스핏|crossfit|gym|스포츠센터|체육관|클라이밍|배드민턴|테니스|헬스장|pt비|퍼스널트레이닝|스피닝|복싱|주짓수', 'health.fitness', GENERIC),
  rule('아이허브|iherb|정관장|고려은단|종근당건강|뉴트리원|마이프로틴', 'health.supplement', BRAND),
  rule('영양제|건강식품|건기식|홍삼|비타민|프로틴|유산균|오메가3|루테인|콜라겐', 'health.supplement', GENERIC),

  /* ---------- 여가·여행 ---------- */
  rule('cgv|롯데시네마|메가박스|megabox|인터파크|티켓링크|ticketlink|씨네큐|독립영화관|아트하우스', 'leisure.movie', BRAND),
  rule('멜론티켓|예스24티켓|yes24티켓', 'leisure.movie', OVERRIDE),
  rule('영화|시네마|씨네|공연|뮤지컬|콘서트|연극|전시|박물관|미술관|페스티벌|입장권|티켓', 'leisure.movie', GENERIC),
  rule('교보문고|예스24|yes24|알라딘|aladin|영풍문고|리디|ridi|리디북스|반디앤루니스|북스리브로', 'leisure.book', BRAND),
  rule('서점|도서|전자책|이북|ebook|만화책|웹툰|카카오페이지|네이버웹툰', 'leisure.book', GENERIC),
  rule('스팀|steam|닌텐도|nintendo|플레이스테이션|playstation|psn|플스|엑스박스|xbox|넥슨|nexon|라이엇|riot|블리자드|blizzard|에픽게임즈|epicgames|카카오게임즈|스마일게이트|넷마블|엔씨소프트|배틀넷|battle.net', 'leisure.game', BRAND),
  rule('게임|pc방|피시방|피씨방|오락실|아케이드', 'leisure.game', GENERIC),
  rule('골프존|스크린골프|에버랜드|롯데월드|서울랜드|캐리비안베이|오션월드|아쿠아리움|아쿠아플라넷|워터파크|테마파크|코인노래방|만화방|방탈출|스카이라인루지|레고랜드', 'leisure.hobby', BRAND),
  rule('골프|볼링|당구|노래방|낚시|캠핑|등산|스키장|스노보드|놀이공원|취미|레저|공방|원데이클래스|서핑|승마|스크린야구|야구장|축구장|경기장|관람', 'leisure.hobby', GENERIC),
  rule('데이트|모임|동호회|송년회|신년회|정모|친목', 'leisure.social', GENERIC),
  rule('회비', 'leisure.social', WEAK),
  rule('대한항공|koreanair|아시아나|asiana|제주항공|jejuair|진에어|jinair|티웨이|tway|에어부산|airbusan|에어서울|airseoul|이스타|eastar|에어프레미아|airpremia|스카이스캐너|skyscanner|에어로케이|플라이강원', 'leisure.flight', BRAND),
  rule('항공|항공권|항공료|비행기', 'leisure.flight', GENERIC),
  rule('야놀자|여기어때|에어비앤비|airbnb|아고다|agoda|부킹닷컴|booking.com|트립닷컴|trip.com|익스피디아|expedia|호텔스닷컴|hotels.com|호텔스컴바인|데일리호텔|신라스테이|롯데호텔|조선호텔', 'leisure.stay', BRAND),
  rule('호텔|hotel|모텔|펜션|리조트|게스트하우스|호스텔|숙박|콘도|글램핑|풀빌라|한옥스테이', 'leisure.stay', GENERIC),
  rule('하나투어|모두투어|노랑풍선|참좋은여행|마이리얼트립|트리플|클룩|klook|kkday|와그|waug|신라면세|롯데면세|신세계면세|면세점', 'leisure.travel', BRAND),
  rule('인터파크투어', 'leisure.travel', OVERRIDE),
  rule('여행|관광|투어|환전|여행사|패키지여행|입장료|기념품', 'leisure.travel', GENERIC),

  /* ---------- 교육 ---------- */
  rule('구몬|눈높이|웅진씽크빅|재능교육|윤선생|링글|ringle|튜터링|청담어학원|정상어학원|ybm어학원|파고다|시사영어|영어회화', 'education.academy', BRAND),
  rule('해커스어학원', 'education.academy', OVERRIDE),
  rule('학원|과외|어학원|학습지|교습소|공부방|튜터|에듀|보습학원|피아노학원|미술학원|태권도|검도|발레|수학학원|영어학원|코딩학원|학원비', 'education.academy', GENERIC),
  rule('인강|클래스101|class101|인프런|inflearn|유데미|udemy|코세라|coursera|패스트캠퍼스|메가스터디|이투스|대성마이맥|에듀윌|해커스|야나두|시원스쿨|듀오링고|duolingo|스픽|말해보카|케이무크|k-mooc|노마드코더|코드잇|프로그래머스|스파르타코딩|클래스유|탈잉', 'education.online', BRAND),
  rule('온라인강의|온라인클래스|강의|강좌|이러닝|사이버강의', 'education.online', GENERIC),
  rule('알파문구|핫트랙스|모닝글로리|드림디포|오피스디포|교보핫트랙스|아트박스|텐바이텐', 'education.books', BRAND),
  rule('교재|문구|문방구|참고서|문제집|필기구|프린트|복사|인쇄|제본|문구점|학용품', 'education.books', GENERIC),
  rule('토익|toeic|토플|toefl|오픽|opic|텝스|teps|한국산업인력공단|큐넷|q-net|ybm시사|한능검|컴활|정보처리|한국사능력|jlpt|hsk|delf|ielts', 'education.exam', BRAND),
  rule('자격증|응시료|시험|검정료|어학시험|시험접수|원서접수', 'education.exam', GENERIC),
  rule('등록금|수강료|대학교|대학원|학비|학교|납입금|교육비|수업료|평생교육원|사이버대|방송통신대|학자금|급식비|스쿨뱅킹', 'education.tuition', GENERIC),

  /* ---------- 가족·경조사 ---------- */
  rule('축의금|조의금|부의금|부조|부조금|경조사|결혼식|장례|장례식장|돌잔치|화환|조화|부고|상조|예식장|웨딩|청첩|답례품|환갑|칠순|백일|돌반지', 'family.ceremony', BRAND),
  rule('카카오선물하기|카카오톡선물하기|선물하기|기프티콘|꽃집|꽃배달|플라워|플라워샵|기프트샵', 'family.gift', BRAND),
  rule('선물|gift|기프트|답례|감사선물', 'family.gift', GENERIC),
  rule('부모님용돈|명절용돈|가족용돈|어버이날|부모님생신', 'family.allowance', BRAND),
  rule('부모님|어머니|아버지|효도|시댁|처가|친정|조카', 'family.allowance', SPECIFIC),
  rule('토이저러스|아가방|베이비페어|맘스홀릭|아이사랑|아이돌봄|키즈카페|베베숲|보령메디앙스|하기스|팸퍼스|마미포코', 'family.kids', BRAND),
  rule('육아|어린이집|유치원|분유|기저귀|아기|키즈|장난감|베이비|baby|유아|아동복|산후조리|이유식|어린이|자녀', 'family.kids', GENERIC),
  rule('동물병원|동물약국|펫프렌즈|어바웃펫|펫스토어|펫샵|애견카페|애견호텔|애견미용|고양이카페|펫시터|펫택시|24시동물', 'family.pet', BRAND),
  rule('펫|강아지|고양이|사료|반려|애견|애묘|캣|고양이모래|배변패드|동물등록', 'family.pet', GENERIC),

  /* ---------- 금융·보험 ---------- */
  rule('삼성화재|현대해상|db손보|db손해보험|kb손보|kb손해보험|메리츠|한화손보|한화손해보험|롯데손보|롯데손해보험|흥국화재|교보생명|삼성생명|한화생명|신한라이프|kb라이프|nh농협생명|농협손보|라이나|aia|카카오페이손보|캐롯|axa|악사|처브|chubb|미래에셋생명|동양생명|abl생명|자동차보험|여행자보험|실손|암보험|치아보험|보험료', 'finance.insurance', BRAND),
  rule('보험', 'finance.insurance', GENERIC),
  rule('국세|지방세|자동차세|재산세|종합소득세|종소세|부가세|부가가치세|취득세|주민세|등록면허세|세무서|위택스|wetax|홈택스|hometax|국세청|국민연금|건강보험|국민건강보험|고용보험|4대보험|장기요양|증권거래세|양도세|상속세|증여세|종부세|면허세|세무대리|세무사', 'finance.tax', BRAND),
  rule('세금|과세|납세|지방세납부|세금납부', 'finance.tax', SPECIFIC),
  rule('지로', 'finance.tax', WEAK),
  rule('연회비|카드연회비|송금수수료|이체수수료|atm수수료|출금수수료|환전수수료|중도상환수수료|해외결제수수료|해외이용수수료|발급수수료|증명서발급|공증|인지세|계좌이체수수료|타행이체수수료', 'finance.fee', BRAND),
  rule('수수료', 'finance.fee', SPECIFIC),
  rule('대출이자|이자납입|이자상환|원리금|대출상환|카드론|현금서비스|리볼빙|할부이자|할부수수료|대출원금|원금상환|마이너스통장|학자금대출|주택담보대출|전세대출|신용대출|대출원리금|이자출금', 'finance.interest', BRAND),
  rule('대출|상환', 'finance.interest', GENERIC),

  /* ---------- 기타 ---------- */
  rule('유니세프|unicef|굿네이버스|세이브더칠드런|월드비전|적십자|구세군|해피빈|기아대책|초록우산|밀알복지|카카오같이가치|같이가치|사랑의열매|한국컴패션|컴패션|동물자유연대|어린이재단|아름다운재단', 'etc.donation', BRAND),
  rule('기부|후원|헌금|십일조|시주|후원금|성금|모금|봉헌|감사헌금', 'etc.donation', GENERIC),
  rule('벌금|과태료|범칙금|연체료|위약금|연체이자|가산금|견인|주정차위반|속도위반|신호위반|과징금|체납', 'etc.penalty', BRAND),

  /* ---------- 수입: 급여 ---------- */
  rule('급여|월급|급여이체|봉급|salary|급여입금|급료|임금|주급|연봉|payroll', 'income.salary.monthly', BRAND),
  rule('상여|성과급|보너스|bonus|인센티브|명절상여|상여금|격려금|포상금|연말성과|경영성과급|pi지급|ps지급', 'income.salary.bonus', BRAND),
  rule('수당|야근수당|초과근무|연장근로|출장비|복지포인트|휴가비|명절선물비|교통비지급|식비지급|퇴직금', 'income.salary.allowance', BRAND),

  /* ---------- 수입: 사업소득 ---------- */
  rule('매출|사업소득|카드매출|매출입금|정산입금|판매정산|매출대금|카드정산|pg정산|토스페이먼츠정산|kg이니시스|나이스페이|이니시스정산', 'income.business.sales', BRAND),
  rule('스마트스토어정산|쿠팡정산|배민정산|네이버페이정산|쿠팡파트너스|배민파트너스', 'income.business.sales', OVERRIDE),
  rule('프리랜서|외주|용역|용역비|원고료|강의료|강사료|출연료|자문료|인세|저작권료|원고비|기타소득|번역료|디자인비|개발비', 'income.business.freelance', BRAND),

  /* ---------- 수입: 용돈 ---------- */
  rule('용돈|세뱃돈|명절돈|생활비지원|생활비이체|엄마용돈|아빠용돈|할머니용돈', 'income.allowance', GENERIC),

  /* ---------- 수입: 이자·배당 ---------- */
  rule('예금이자|적금이자|이자입금|이자지급|만기이자|cma이자|파킹통장이자|결산이자|이자소득', 'income.investment.interest', BRAND),
  rule('이자', 'income.investment.interest', SPECIFIC),
  rule('배당|배당금|분배금|주식배당|배당입금|배당소득', 'income.investment.dividend', BRAND),
  rule('매도|매매차익|매도대금|투자수익|주식매도|코인|암호화폐|업비트|upbit|빗썸|bithumb|코인원|증권출금|펀드환매|환매', 'income.investment.gain', SPECIFIC),

  /* ---------- 수입: 부수입 ---------- */
  rule('당근|당근마켓|당근페이|중고나라|번개장터|번개페이|헬로마켓|판매대금|중고판매|리셀|크림정산', 'income.side.resale', BRAND),
  rule('판매|중고', 'income.side.resale', GENERIC),
  rule('앱테크|리워드|포인트적립|토스포인트|캐시워크|만보기|이벤트당첨|당첨금|경품|설문|서베이|패널|출석체크|행운퀴즈|머니모으기|캐시슬라이드', 'income.side.reward', BRAND),
  rule('부업|알바|아르바이트|단기알바|크몽|숨고|배달수입|파트타임|일당|일용직|일용근로|알바비|투잡|과외비', 'income.side.gig', BRAND),

  /* ---------- 수입: 환급·정산 ---------- */
  rule('세금환급|국세환급|지방세환급|연말정산환급|건강보험환급|보험료환급|환급금|국민연금환급|종소세환급|부가세환급', 'income.refund.tax', OVERRIDE),
  rule('환급|연말정산', 'income.refund.tax', SPECIFIC),
  rule('캐시백|cashback|페이백|카드캐시백|청구할인|적립금|캐시백입금|포인트입금|페이백입금', 'income.refund.cashback', BRAND),
  rule('더치페이|n빵|엔빵|1/n|모임비정산|회비정산|정산금|정산받음|송금받음|더치|나눠내기', 'income.refund.settlement', BRAND),
  rule('정산', 'income.refund.settlement', GENERIC),
  rule('보험금|실손보험금|실비보험금|보험금지급|보험금입금|보험금수령|보험환급', 'income.refund.insurance', OVERRIDE),
]
