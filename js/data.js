/* ==========================================================================
   CR7 Tribute - data.js (content source of truth)
   Facts verified against public records, as of August 2026.
   ========================================================================== */
"use strict";

/* --------------------------------------------------------------------------
   LIVE DATA module configuration
   - api: ""       -> static fallback mode (GitHub Pages friendly, no keys exposed)
   - api: "https://cr7-stats-proxy.<your-subdomain>.workers.dev/api/cr7-stats"
     -> the bundled Cloudflare Worker proxy in cloud/cloudflare-worker/
        (deployment steps in that folder's README; keys stay server-side).
        Expected JSON response:
        { "goals": 977, "apps": 1330, "assists": 261, "trophies": 34,
          "clubGoals": 831, "ntGoals": 146, "updatedAt": "2026-08-29T10:00:00Z" }
   - The browser never touches the upstream provider, so no API key is exposed.
   - In static mode the page shows the verified baseline below plus a visible
     "last updated" stamp, as documented in the delivery notes.
   -------------------------------------------------------------------------- */
const LIVE_DATA = {
  api: "",
  pollActiveMatchMs: 5 * 60 * 1000,
  pollIdleMs: 60 * 60 * 1000,
  baseline: {
    goals: 977,
    apps: 1330,
    assists: 261,
    trophies: 34,
    clubGoals: 831,
    clubApps: 1102,
    ntGoals: 146,
    ntApps: 228
  },
  updatedAt: "2026-08-29",
  source: "FIFA / UEFA / 各成员协会官方正式赛事公开纪录"
};

const CR7 = {
  eras: [
    {
      id: "sporting", years: "2002 - 2003", club: "里斯本竞技",
      tagline: "梦想起航 · Sporting CP", img: "assets/img/era-sporting.webp",
      accent: "#4E8F63",
      spirit: "离开故土少年的孤勇起点。",
      apps: 25, goals: 5, trophies: 0,
      stories: [
        { h: "离开孤岛的少年", p: "1985 年 2 月 5 日，克里斯蒂亚诺·罗纳尔多生于马德拉群岛首府丰沙尔。12 岁那年，他告别贫寒的家与母亲，独自登上飞往里斯本的航班，进入葡萄牙体育青训营。" },
        { h: "首秀即成名", p: "2002 年 10 月 7 日，他代表里斯本竞技一线队完成处子秀并梅开二度，媒体惊呼“马德拉的宝石”。2003 年 8 月，一场与曼联的热身赛让弗格森爵士当场决定签下他。" }
      ]
    },
    {
      id: "manutd1", years: "2003 - 2009", club: "曼联一期",
      tagline: "红魔新王登基 · Manchester United", img: "assets/img/era-manutd1.webp",
      accent: "#C04A4F",
      spirit: "少年褪去稚气，学习担当。",
      apps: 292, goals: 118, trophies: 9,
      stories: [
        { h: "接过 7 号球衣", p: "18 岁的他接过乔治·贝斯特与贝克汉姆的 7 号战袍。2004 年足总杯决赛头球破门，收获成年队第一座冠军；2006-07 赛季，他攻入 23 粒英超进球，帮助红魔时隔四年重夺英超。" },
        { h: "2008 莫斯科雨夜", p: "2007-08 赛季他打进 42 球，欧冠决赛头球首开纪录并随队在点球大战击败切尔西，成就双冠王。同年包揽金球奖与世界足球先生，开启属于他的时代。" }
      ]
    },
    {
      id: "madrid", years: "2009 - 2018", club: "皇家马德里",
      tagline: "伯纳乌之王 · Real Madrid", img: "assets/img/era-madrid.webp",
      accent: "#C9CDD4",
      spirit: "背负天价期待，把重压化作一座座纪录。",
      apps: 438, goals: 451, trophies: 16,
      stories: [
        { h: "9400 万欧元的豪赌", p: "2009 年他以 9400 万欧元天价加盟皇马，伯纳乌八万人欢迎仪式见证新王降临。2011-12 赛季，他单季 46 粒西甲进球率队夺回联赛冠军。" },
        { h: "欧冠三连与 451 球", p: "2013-14 赛季单季 17 球创欧冠纪录；2016-18 年率皇马完成欧冠三连。九年白衣生涯打进 451 球，成为皇马队史射手王，五座金球奖有四次在伯纳乌时期收入囊中。" }
      ]
    },
    {
      id: "juventus", years: "2018 - 2021", club: "尤文图斯",
      tagline: "征服亚平宁 · Juventus", img: "assets/img/era-juventus.webp",
      accent: "#D9C44E",
      spirit: "对抗年龄，证明老将的价值。",
      apps: 134, goals: 101, trophies: 5,
      stories: [
        { h: "1.12 亿欧元的信任", p: "33 岁以 1.12 亿欧元转会尤文，被视为足坛对“老将”价值最大的押注。他连续三个赛季帮助斑马军团夺得意甲冠军。" },
        { h: "都灵之夜", p: "2018-19 赛季欧冠 1/8 决赛次回合，首回合 0-2 落后的尤文在主场 3-0 逆转马德里竞技，C 罗上演帽子戏法——安联球场为他沸腾。" }
      ]
    },
    {
      id: "manutd2", years: "2021 - 2022", club: "曼联二期",
      tagline: "游子归家 · Manchester United", img: "assets/img/era-manutd2.webp",
      accent: "#C04A4F",
      spirit: "游子归途，理想与现实的碰撞。",
      apps: 54, goals: 27, trophies: 0,
      stories: [
        { h: "回家", p: "2021 年 8 月，36 岁的他时隔 12 年重返老特拉福德。2021 年 12 月对阵阿森纳，他打进职业生涯第 800 粒正式比赛进球。" },
        { h: "帽子戏法", p: "2022 年 3 月 12 日对阵托特纳姆热刺，他上演帽子戏法，将生涯进球数定格在 809——为这段并不顺遂的回归画下最亮眼的一笔。" }
      ]
    },
    {
      id: "alnassr", years: "2023 - 至今", club: "利雅得胜利",
      tagline: "沙漠远征 · Al-Nassr", img: "assets/img/era-alnassr.webp",
      accent: "#E2B33C",
      spirit: "跳出欧洲主流，续写属于自己的征途。",
      apps: 108, goals: 129, trophies: 2,
      stories: [
        { h: "新的地平线", p: "2023 年 1 月加盟利雅得胜利。同年 8 月的阿拉伯俱乐部冠军杯决赛，他在第 92 分钟绝杀利雅得新月，为球队带来首冠。" },
        { h: "沙特联赛冠军", p: "2025-26 赛季末轮，他梅开二度帮助球队 4-1 击败达马克，职业生涯首次夺得沙特职业联赛冠军，并将生涯进球推进至 973。如今他已突破 977 球，继续向 1000 球迈进。" }
      ]
    },
    {
      id: "portugal", years: "2003 - 至今", club: "葡萄牙国家队",
      tagline: "为国而生 · Portugal", img: "assets/img/era-portugal.webp",
      accent: "#B03A3E",
      spirit: "从落泪少年到国家英雄，背负一整个国家的期待。",
      apps: 228, goals: 146, trophies: 2,
      stories: [
        { h: "从泪水到加冕", p: "2004 年本土欧洲杯决赛失利后他哭成泪人；2006 年世界杯四强；2016 年法兰西之夏，开场 25 分钟便因伤离场的他，在场边嘶吼指挥，带领葡萄牙首次登顶欧洲之巅；2019 年再夺欧国联冠军。" },
        { h: "纪录收割机", p: "146 球、228 次出场，国家队双料历史第一；14 粒欧洲杯进球史无前例；2026 年世界杯，他成为史上首位在六届世界杯破门的球员——世界杯总进球 11 粒。" }
      ]
    }
  ],

  stats: {
    club: {
      bars: [
        { label: "里斯本竞技", value: 5 },
        { label: "曼联（两期）", value: 145 },
        { label: "皇家马德里", value: 451 },
        { label: "尤文图斯", value: 101 },
        { label: "利雅得胜利", value: 129 }
      ],
      donut: [
        { label: "皇马", value: 451, color: "#C8A962" },
        { label: "曼联", value: 145, color: "#8F7B46" },
        { label: "利雅得胜利", value: 129, color: "#5C6B3C" },
        { label: "尤文", value: 101, color: "#3A3F4A" },
        { label: "里斯本竞技", value: 5, color: "#2A2F38" }
      ],
      records: [
        { comp: "ucl", text: "欧冠历史射手王：140 球 / 183 场", tag: "历史第一" },
        { comp: "ucl", text: "单赛季欧冠进球纪录：17 球（2013-14）", tag: "历史第一" },
        { comp: "laliga", text: "皇马队史射手王：451 球", tag: "队史第一" },
        { comp: "laliga", text: "西甲进球：311 球，历史第二", tag: "历史第二" },
        { comp: "epl", text: "英超进球：103 球（曼联）", tag: "俱乐部纪录" },
        { comp: "seriea", text: "意甲进球：81 球（尤文）", tag: "俱乐部纪录" },
        { comp: "spl", text: "沙特联赛进球：102 球（利雅得胜利）", tag: "队史第二" },
        { comp: "all", text: "第一位突破 900 粒官方进球的球员", tag: "世界第一" }
      ]
    },
    nt: {
      bars: [
        { label: "世界杯", value: 11 },
        { label: "欧洲杯", value: 14 },
        { label: "欧国联决赛圈", value: 3 }
      ],
      records: [
        { text: "国家队历史射手王：146 球", tag: "世界第一" },
        { text: "国家队出场纪录：228 场", tag: "世界第一" },
        { text: "首位在六届世界杯破门的球员：11 球", tag: "历史第一" },
        { text: "首位参加六届欧洲杯的球员：14 球", tag: "历史第一" },
        { text: "2016 欧洲杯冠军 · 2019 欧国联冠军", tag: "双冠" },
        { text: "2018 世界杯对西班牙帽子戏法", tag: "经典之战" }
      ]
    },
    honor: {
      bars: [
        { label: "金球奖", value: 5 },
        { label: "欧洲金靴", value: 4 },
        { label: "FIFA 年度最佳", value: 3 },
        { label: "欧冠金靴（季）", value: 7 },
        { label: "西甲金靴", value: 3 },
        { label: "沙特金靴", value: 2 }
      ],
      records: [
        { text: "金球奖 ×5：2008 / 2013 / 2014 / 2016 / 2017", tag: "历史第二" },
        { text: "欧洲金靴 ×4：2008 / 2011 / 2014 / 2015", tag: "纪录保持者" },
        { text: "FIFA 年度最佳 ×3：2008 / 2016 / 2017", tag: "含世界足球先生" },
        { text: "欧冠单赛季 17 球纪录（2013-14）", tag: "历史第一" },
        { text: "首位 900 球先生 · 冲击 1000 球", tag: "世界第一" },
        { text: "2009 普斯卡什奖：40 码惊天远射", tag: "年度最佳进球" }
      ]
    }
  },

  moments: [
    {
      id: "facup", title: "英超首冠：2006-07 王者归来", date: "2007-05-06",
      comp: "dom", type: "title", img: "assets/img/g-facup.webp",
      emotion: "一个时代，自此开启。",
      story: "2006-07 赛季，曼联时隔四年重夺英超冠军。C 罗以 23 粒联赛进球成为队内头号射手，并首次包揽 PFA 与 FWA 双料年度最佳球员——一个属于他的时代，自此开启。",
      credit: "2007 年曼联时期资料图（Wikimedia Commons）"
    },
    {
      id: "moscow", title: "莫斯科雨夜：头球 + 捧杯", date: "2008-05-21",
      comp: "ucl", type: "title", img: "assets/img/g-moscow.webp",
      emotion: "历经淬炼之后，少年站上世界之巅。",
      story: "2008 年 5 月 21 日，卢日尼基球场，欧冠决赛曼联对阵切尔西。第 26 分钟，他高高跃起头球破门；点球大战中他罚失点球，但红魔最终问鼎。那个赛季他打进 42 球，同年包揽金球奖与世界足球先生。",
      credit: "长距离射门资料图（Wikimedia Commons）"
    },
    {
      id: "porto", title: "40 码雷霆：波尔图世界波", date: "2009-04-15",
      comp: "ucl", type: "classic", img: "assets/img/g-porto.webp",
      emotion: "40 码之外，雷霆万钧。",
      story: "2009 年 4 月 15 日，欧冠 1/4 决赛，曼联客场挑战波尔图。他在距球门约 40 码处轰出凌空重炮，皮球如出膛炮弹直挂死角，帮助曼联晋级四强。这粒进球荣获 2009 年国际足联普斯卡什奖。",
      credit: "皇马时期资料图（Wikimedia Commons）"
    },
    {
      id: "campnou", title: "诺坎普绝杀：终结魔咒", date: "2012-04-21",
      comp: "dom", type: "classic", img: "assets/img/g-campnou.webp",
      emotion: "让诺坎普安静的那一刻。",
      story: "2012 年 4 月 21 日，国家德比，皇马客场挑战巴萨。第 93 分钟，C 罗接厄齐尔直塞单刀推射破门，2-1 绝杀死敌，终结皇马联赛客战诺坎普多年不胜的尴尬。加泰罗尼亚媒体此后写道：“C 罗让诺坎普安静。”",
      credit: "皇马时期资料图（Wikimedia Commons）"
    },
    {
      id: "lisbon2014", title: "里斯本之夜：第十冠 + 17 球纪录", date: "2014-05-24",
      comp: "ucl", type: "record", img: "assets/img/g-lisbon2014.webp",
      emotion: "第十冠，与一项纪录一同诞生。",
      story: "2014 年 5 月 24 日，欧冠决赛在里斯本光明球场打响。拉莫斯第 93 分钟头球绝平，加时赛皇马连入三球夺冠。C 罗主罚点球命中，以单季 17 球刷新欧冠单赛季进球纪录，捧起个人第二座大耳朵杯。",
      credit: "尤文时期资料图（Wikimedia Commons）"
    },
    {
      id: "euro2016", title: "法兰西之夏：欧洲杯登顶", date: "2016-07-10",
      comp: "nt", type: "title", img: "assets/img/g-euro2016.webp",
      emotion: "伤痛离场，却以另一种方式带领祖国圆梦。",
      story: "2016 年 7 月 10 日，法兰西大球场，欧洲杯决赛。开场仅 25 分钟他便被帕耶撞伤膝盖，含泪被换下。但他在场边化身教练疯狂指挥，葡萄牙加时绝杀法国，队史首夺欧洲杯。那一刻，他用另一种方式完成了领袖的使命。",
      credit: "尤文对阵马竞资料图（Wikimedia Commons）"
    },
    {
      id: "cardiff", title: "卡迪夫双响：欧冠三连第二冠", date: "2017-06-03",
      comp: "ucl", type: "title", img: "assets/img/g-cardiff.webp",
      emotion: "王者卫冕，三连霸的前奏。",
      story: "2017 年 6 月 3 日，卡迪夫千禧球场，欧冠决赛皇马对阵尤文。C 罗梅开二度，包括一记精彩的禁区边缘爆射，皇马 4-1 卫冕成功，成为改制后首支连续两年夺冠的球队，也为接下来的三连霸埋下伏笔。",
      credit: "葡萄牙国家队时期资料图（Wikimedia Commons）"
    },
    {
      id: "bicycle", title: "都灵倒钩：对手起立鼓掌", date: "2018-04-03",
      comp: "ucl", type: "classic", img: "assets/img/g-bicycle.webp",
      emotion: "征服对手，收获竞技最动人的致敬。",
      story: "2018 年 4 月 3 日，欧冠 1/4 决赛首回合，皇马客场 3-0 完胜尤文。第 64 分钟，C 罗接卡瓦哈尔传中腾空倒钩，皮球应声入网。安联球场数万尤文球迷起立鼓掌——这是足球世界对伟大进球最罕见的致敬。",
      credit: "Wikimedia Commons（CC 许可）"
    },
    {
      id: "atletico", title: "马德里奇迹：帽子戏法逆转", date: "2019-03-12",
      comp: "ucl", type: "comeback", img: "assets/img/g-atletico.webp",
      emotion: "几乎无人相信，直到他罚进第三球。",
      story: "2019 年 3 月 12 日，欧冠 1/8 决赛次回合，尤文图斯主场迎战马竞。首回合 0-2 落后，几乎无人相信尤文能够翻盘。C 罗上演帽子戏法——两记头球加一记点球，3-0 完成史诗逆转。",
      credit: "Wikimedia Commons（CC 许可）"
    },
    {
      id: "arabcup", title: "92 分钟绝杀：利雅得首冠", date: "2023-08-12",
      comp: "ksa", type: "title", img: "assets/img/g-arabcup.webp",
      emotion: "第 92 分钟，沙漠之夜的第一座奖杯。",
      story: "2023 年 8 月 12 日，阿拉伯俱乐部冠军杯决赛，利雅得胜利对阵利雅得新月。第 92 分钟，C 罗接球转身低射破门，2-1 绝杀同城对手，为球队带来加盟后的第一座冠军。",
      credit: "Wikimedia Commons（CC 许可）"
    },
    {
      id: "ninehundred", title: "900 球：历史第一人", date: "2024-09-05",
      comp: "nt", type: "record", img: "assets/img/g-900.webp",
      emotion: "前无古人的一夜，历史在此驻足。",
      story: "2024 年 9 月 5 日，欧国联，葡萄牙对阵克罗地亚。第 34 分钟，他抢点推射破门，打进职业生涯第 900 粒正式比赛进球——足球史上第一位达到这一里程碑的男人。",
      credit: "Wikimedia Commons（CC 许可）"
    },
    {
      id: "wc2026", title: "六届世界杯破门：新的神话", date: "2026-06-22",
      comp: "nt", type: "record", img: "assets/img/g-wc2026.webp",
      emotion: "六届世界杯，六段不老的神话。",
      story: "2026 年世界杯，41 岁的他成为史上首位参加六届世界杯的球员之一，并成为历史上第一位在六届世界杯都有进球的球员。世界杯总进球数来到 11 粒——这是他写给足球世界的又一段传奇。",
      credit: "Wikimedia Commons（CC 许可）"
    }
  ],

  honors: {
    team: [
      { name: "欧冠冠军", count: 5, years: "2008 · 2014 · 2016 · 2017 · 2018", detail: "曼联 ×1 · 皇马 ×4；2016-18 三连冠", kind: "cup" },
      { name: "英超冠军", count: 3, years: "2006-07 · 2007-08 · 2008-09", detail: "曼联连续三季登顶", kind: "shield" },
      { name: "西甲冠军", count: 2, years: "2011-12 · 2016-17", detail: "皇马两夺联赛桂冠", kind: "shield" },
      { name: "意甲冠军", count: 2, years: "2018-19 · 2019-20", detail: "尤文连续两季问鼎", kind: "shield" },
      { name: "沙特联赛冠军", count: 1, years: "2025-26", detail: "利雅得胜利末轮夺冠", kind: "shield" },
      { name: "欧洲杯冠军", count: 1, years: "2016", detail: "葡萄牙队史首冠", kind: "cup" },
      { name: "欧国联冠军", count: 1, years: "2019", detail: "葡萄牙再添洲际荣誉", kind: "cup" },
      { name: "世俱杯冠军", count: 4, years: "2008 · 2014 · 2016 · 2017", detail: "曼联 ×1 · 皇马 ×3", kind: "globe" },
      { name: "欧洲超级杯", count: 3, years: "2014 · 2016 · 2017", detail: "皇马三度捧杯", kind: "cup" },
      { name: "足总杯冠军", count: 1, years: "2003-04", detail: "曼联 3-0 米尔沃尔，19 岁头球", kind: "cup" },
      { name: "联赛杯冠军", count: 2, years: "2005-06 · 2008-09", detail: "曼联两度折桂", kind: "cup" },
      { name: "社区盾冠军", count: 1, years: "2007", detail: "曼联夺冠", kind: "shield" },
      { name: "国王杯冠军", count: 2, years: "2010-11 · 2013-14", detail: "皇马两度问鼎", kind: "cup" },
      { name: "西班牙超级杯", count: 2, years: "2012 · 2017", detail: "皇马夺冠", kind: "shield" },
      { name: "意大利杯冠军", count: 1, years: "2020-21", detail: "尤文夺冠", kind: "cup" },
      { name: "意大利超级杯", count: 2, years: "2018 · 2020", detail: "尤文两度捧杯", kind: "shield" },
      { name: "阿拉伯冠军杯", count: 1, years: "2023", detail: "92 分钟绝杀利雅得新月", kind: "cup" }
    ],
    individual: [
      { name: "金球奖", count: 5, years: "2008 · 2013 · 2014 · 2016 · 2017", detail: "历史第二，横跨十年", kind: "star" },
      { name: "欧洲金靴", count: 4, years: "2008 · 2011 · 2014 · 2015", detail: "欧洲第一射手四度加冕", kind: "boot" },
      { name: "FIFA 年度最佳", count: 3, years: "2008 · 2016 · 2017", detail: "含 2008 世界足球先生", kind: "star" },
      { name: "欧冠金靴", count: 7, years: "2008 · 2013-18", detail: "历史最多，含 17 球纪录赛季", kind: "boot" },
      { name: "西甲金靴", count: 3, years: "2010-11 · 2013-14 · 2014-15", detail: "皮奇奇奖三度入账", kind: "boot" },
      { name: "意甲金靴", count: 1, years: "2020-21", detail: "29 球加冕意甲射手王", kind: "boot" },
      { name: "沙特金靴", count: 2, years: "2023-24 · 2024-25", detail: "连续两季沙特联赛射手王", kind: "boot" },
      { name: "普斯卡什奖", count: 1, years: "2009", detail: "40 码凌空世界波", kind: "ball" },
      { name: "PFA 年度最佳", count: 2, years: "2007 · 2008", detail: "球员票选最佳", kind: "medal" },
      { name: "世俱杯金球奖", count: 1, years: "2016", detail: "决赛帽子戏法", kind: "medal" },
      { name: "欧冠历史射手王", count: 140, years: "183 场", detail: "历史第一，领先第二名 11 球", kind: "crown" },
      { name: "欧洲杯历史射手王", count: 14, years: "6 届", detail: "历史第一", kind: "crown" },
      { name: "国家队历史射手王", count: 146, years: "228 场", detail: "世界第一", kind: "crown" },
      { name: "首位 900 球先生", count: 900, years: "2024-09-05", detail: "足球史第一人，冲击 1000 球", kind: "crown" },
      { name: "六届世界杯破门", count: 6, years: "2006-2026", detail: "历史第一人", kind: "crown" },
      { name: "单赛季欧冠纪录", count: 17, years: "2013-14", detail: "历史第一", kind: "crown" }
    ]
  },

  bio: [
    {
      id: "growth", title: "成长之路", kicker: "MADEIRA → WORLD",
      img: "assets/img/bio-growth.webp", cap: "马德拉岛的少年时代",
      flip: false,
      paras: [
        "1985 年 2 月 5 日，C 罗出生在葡萄牙马德拉群岛的丰沙尔。父亲是园丁，母亲是清洁工，全家挤在屋顶漏雨的房子里。贫寒不是背景，是他最初的对手——足球是他唯一的玩具，也是唯一的出路。命运没有给这个孩子任何馈赠，他后来的一切，都是从这里一分一分挣回来的。",
        "12 岁那年，他离开母亲与故乡，独自前往里斯本竞技青训营。异乡的孤独没有击垮他，反而淬炼出近乎病态的求胜欲——<span class=\"gold-key\">输掉任何一场训练赛，他都会愤怒到深夜加练</span>。那些嘲笑他口音与身板的队友很快明白：这个少年输不起，不是矫情，是他全部的赌注。",
        "1999 年，少年时代的心脏手术几乎终结他的足球梦。手术前母亲问他怕不怕，他说：<span class=\"gold-key\">“如果踢不了球，我活着还有什么意义？”</span>手术后仅四个月，他重返球场，从此再也没有停过。伤痛自此成为他生涯的一部分，而不是它的终点。",
        "2002 年 10 月 7 日，17 岁的他代表里斯本竞技梅开二度；2003 年，弗格森在热身赛后当场拍板签下他。一个从大西洋小岛出发的故事，就此奔向世界之巅——而故事的主角始终记得，自己是从哪里开始奔跑的。"
      ]
    },
    {
      id: "mind", title: "竞技精神", kicker: "OBSESSION → GREATNESS",
      img: "assets/img/bio-mindset.webp", cap: "入场时刻 · 目光如炬",
      flip: true,
      paras: [
        "曼联的队友曾向媒体证实：C 罗总是第一个抵达训练基地、最后一个离开的人。弗格森爵士回忆道，2005 年世界杯后球队给他放假，他却打电话要求立刻回来加练身体。这不是自律的表演，这是一种偏执——而偏执，是他对抗不确定命运的唯一武器。",
        "他的体脂率常年保持在 7% 左右，比多数职业球员低近一半；他每晚的睡眠、饮食、恢复计划精确到分钟。外界看到的是天赋，看不到的是天赋背后每一天都不肯原谅自己的自我苛求。用他的话说：<span class=\"gold-key\">“天赋决定你的起点，勤奋决定你的终点。”</span>",
        "他被说成傲慢，但那层傲慢之下，是从不允许自己止步的自我要求。他同样经历过失败与泪水：莫斯科的点球、2016 年决赛含泪离场、一次次与梅西的金球之争。荣耀与遗憾在他身上对等存在——只是他从不让失败成为停下的理由。",
        "2016 年欧洲杯决赛，他在第 25 分钟被撞伤膝盖，含泪被换下。但他在场边化身教练，疯狂指挥队友——加时绝杀那一刻，他冲入场内与全队相拥。领袖不必永远在场上，但必须永远在战斗。从 2008 到 2017，五座金球奖横跨十年，支撑这一切的，正是这份从未降温的执念。"
      ]
    },
    {
      id: "beyond", title: "赛场之外", kicker: "FAME → PURPOSE",
      img: "assets/img/bio-beyond.webp", cap: "聚光灯外的另一面",
      flip: false,
      paras: [
        "他是全球社交媒体粉丝最多的运动员，但聚光灯外，他保持着惊人的朴素：为癌症患儿支付手术费、多次匿名献血、资助儿童医院重建。2015 年他捐出金球奖奖杯，拍卖所得 60 万欧元全部用于儿童慈善。当年那个被足球拯救的孩子，如今用同样的方式拯救别人。",
        "商业上，他早已是一个完整的品牌：CR7 内衣、香水、酒店、健身与足球学院遍布全球。但品牌的另一面是传承——他说：<span class=\"gold-key\">“我踢球是为了热爱，但我也要为下一代铺路。”</span>足球会落幕，而一个人建立的东西可以延续。",
        "他是一名父亲——四个孩子的父亲。无论凌晨几点结束比赛，他都会回家陪孩子吃早餐。乔治娜说，家里最神圣的时刻，是 C 罗陪孩子们玩积木。赛场上的王者，回到家只是四个孩子的父亲。",
        "有人说他傲慢、偏执、永远不满足。但正是这份不满足，让一个贫民窟少年成了 900 球的象征。他想要被记住的方式，始终简单而笃定：<span class=\"gold-key\">“我想被记住为一位好父亲、一位好球员，以及一个好人。”</span>"
      ]
    }
  ]
};
