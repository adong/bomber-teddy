/* 中文 for BombasTTic!: the words on the page, the toasts and banners, the ? panel (Kit.lang, from kit/lang.js), and
   the comic words drawn on canvases (OOPS!, POP!, SWISH!, through Kit.lang.t in js/art.js).
   The kids' names, the game's name and logo, and the letters on the toy-room alphabet blocks stay in English on purpose. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BRUNO', 'BOLT', 'BombasTTic!', 'BombasTTic', 'Claude Code', 'Esc', 'VS']);

  const THEME = { BACKYARD: '后院', 'TOY ROOM': '玩具房', 'SNOW PARK': '雪地公园', 'SPACE BASE': '太空基地' };
  const ITEM = { 'EXTRA BOMB': '多一个炸弹', 'BIGGER BLAST': '炸得更远', 'SPEEDY SHOES': '飞毛腿鞋', 'BOMB KICK': '踢炸弹', 'EXTRA HEART': '多一颗心' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const KEY = { T: 'T', Enter: '回车' };

  L.add({ zombies: '僵尸', robots: '机器人' }); // the foe counters' pictures (aria-label: Kit.lang translates it, not alt)
  L.add({
    // title screen
    "Teddy & Tommy's confetti bomb maze": 'Teddy 和 Tommy 的彩纸炸弹迷宫',
    '🎈 ADVENTURE': '🎈 冒险', '1 player · 12 stages': '单人 · 12 关',
    '👫 TEAM UP': '👫 一起闯关', '2 players, one adventure': '两个人一起冒险',
    '🥊 BATTLE': '🥊 对战', 'Teddy vs Tommy · best of 3': 'Teddy 对 Tommy · 三局两胜',
    'for little bombers': '小小炸弹手', 'for big kids': '大孩子玩', Difficulty: '难度',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2', 'drop a bomb': '放炸弹',
    "Thumb on the pad to walk, 💣 to drop a bomb, and tap your brother's face to call him in. Two players can share an iPad: each gets a pad and a bomb button.":
      '拇指放在圆盘上走路，点 💣 放炸弹，点兄弟的头像叫他来帮忙。两个人可以一起玩一台 iPad：每人一个圆盘和一个炸弹按钮。',
    'LOADING…': '加载中…', '↻ Turn sideways for a bigger arena!': '↻ 把手机横过来，场地更大！',
    // pick your heroes
    'PICK YOUR HERO': '选择你的英雄', 'PICK YOUR TEAM': '选择你们的队伍', 'WHO VS WHO?': '谁对谁？',
    '+ buddy': '+ 帮手', '👤 PLAYER 2': '👤 玩家 2', '🤖 COMPUTER': '🤖 电脑',
    '◀ BACK': '◀ 返回', "LET'S GO!": '出发！',
    'hero ·': '选英雄 ·', 'stage ·': '选关卡 ·', 'go ·': '出发 ·', back: '返回', 'computer or player ·': '电脑或玩家 ·',
    // HUD and buttons (their tooltips too)
    bombs: '炸弹数', 'blast size': '爆炸范围', speed: '速度', 'bomb kick': '踢炸弹', 'his shield': '他的护盾',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', BOMB: '炸弹', CPU: '电脑',
    // toasts
    "⭐ THERE'S THE EXIT!": '⭐ 出口在那儿！',
    '⭐ ALL POPPED! RUN TO THE EXIT!': '⭐ 坏蛋全打光了！快跑去出口！',
    '⭐ ALL POPPED! FIND THE EXIT!': '⭐ 坏蛋全打光了！快找出口！',
    // banners
    'STAGE CLEAR!': '过关啦！', 'YOU DID IT!': '你做到啦！', 'OOPS!': '哎呀！', 'Out of hearts': '红心用完了',
    'FINAL ROUND': '决胜局', 'last one standing': '坚持到了最后！', 'TIME!': '时间到！', 'nobody wins this one': '这局没人赢',
    'DRAW!': '平局！', 'both got bonked': '两个都被炸晕啦',
    // pause and results
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    "IT'S A TIE!": '平手！', 'Everybody gets a cookie 🍪': '每人一块饼干 🍪', 'Best of 3 · what a match!': '三局两胜 · 真精彩！',
    '↻ REMATCH': '↻ 再比一场', '↻ TRY AGAIN': '↻ 再试一次', '↻ PLAY AGAIN': '↻ 再玩一次', '↻ AGAIN': '↻ 再来',
    'Every stage cleared. High five! ✋': '所有关卡都过啦，击个掌！✋', 'Enter again · Esc menu': '回车 再来 · Esc 菜单',
    // comic words drawn on the canvas
    'POP!': '啵！', 'SWISH!': '唰！',
    // the ? panel (js/keys.js)
    'Slide your thumb on the round pad, tap 💣 to drop a bomb, and tap his face to call your brother.':
      '拇指在圆盘上滑动走路，点 💣 放炸弹，点他的头像叫兄弟来帮忙。',
  });

  const theme = (s) => s.replace(/^(BACKYARD|TOY ROOM|SNOW PARK|SPACE BASE)\b/, (m) => THEME[m]);
  L.rule(/^(BACKYARD|TOY ROOM|SNOW PARK|SPACE BASE)( \d-\d)?( ✓)?$/, (m) => theme(m));
  L.rule(/^STAGE (\d+)$/, '第 $1 关');
  L.rule(/^STAGE (\d+) · (.+)$/, (m, n, name) => `第 ${n} 关 · ${theme(name)}`);
  L.rule(/^ROUND (\d+)$/, '第 $1 局');
  L.rule(/^SCORE ([\d,]+)$/, '得分 $1');
  L.rule(/^(\S+) (?:(.+): )?(EXTRA BOMB|BIGGER BLAST|SPEEDY SHOES|BOMB KICK|EXTRA HEART)!$/, (m, e, who, item) => `${e} ${who ? who + '：' : ''}${ITEM[item]}！`);
  L.rule(/^⭐ (.+) GOT ONE!$/, '⭐ $1 打中一个！');
  L.rule(/^🛡️ (.+) SAVED YOU!$/, '🛡️ $1 救了你！');
  L.rule(/^(.+) IS OUT OF HEARTS$/, '$1 的红心用完了');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(.+) found the exit$/, '$1 找到出口啦');
  L.rule(/^(.+) cleared every stage!$/, '$1 通关啦！');
  L.rule(/^(.+) WINS!$/, '$1 赢了！');
  L.rule(/^(.+) \(CPU\)$/, '$1（电脑）');
  L.rule(/^Call (\S+)(?: \((T|Enter)\))?$/, (m, who, k) => `叫 ${who} 来帮忙${k ? ` (${KEY[k]})` : ''}`);
  L.rule(/^Out of hearts on stage (\d+)\. Try again: your power-ups stay!$/, '第 $1 关的红心用完了。再试一次，道具都还在！');
  L.rule(/^Oops, something went wrong: (.*)$/, '哎呀，出错了：$1');
})();
