import { B, type Game, type Upgrade } from './game/simulation';
export const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const upgrades: [Upgrade, string, string][] = [
  ['carry', '넓은 트레이', '한 번에 2개 → 3개 운반'],
  ['runner', '운반 친구', '완성품을 선반으로 직접 운반'],
  ['runnerCarry', '친구의 큰 트레이', '운반 친구가 한 번에 2개 운반'],
  ['expansion', '두 번째 작업실', '새 공간 + 12초마다 개봉하는 직원'],
];
export function setupUI() {
  document.querySelector('#app')!.innerHTML =
    `<canvas tabindex="0" id="world" aria-label="왁뿌 3D 말랑 공방"></canvas><div id="hud"><div class="wallet"><span class="coin">W</span><b id="coins">0</b><span id="carry">0 / 2</span></div><div id="objective">민트색 작업대로 가 보세요</div><div class="top-actions"><button id="upgrades" aria-label="가게 성장">성장 <span>↗</span></button><button id="pause" aria-label="일시정지">Ⅱ</button></div></div><div id="toast" role="status"></div><div id="benchHUD" hidden><div class="bench-title">톡, 바삭. 말랑!</div><div class="progress"><i id="bar"></i></div><div id="benchHint">껍질을 누른 채 문질러 주세요</div><button id="back">← 매장</button><div class="bench-tools"><div class="bench-row"><button id="press" aria-pressed="true">누르기</button><button id="rotate" aria-pressed="false">돌리기</button><button id="sweep" aria-pressed="false">쓸기</button><button id="clear">파편 정리</button></div><div class="bench-row"><select id="model" aria-label="말랑이 모델"><option value="Butter">버터</option><option value="Chocolate">초콜릿</option><option value="Corn">옥수수</option><option value="CrunchMango">망고</option><option value="JumboCheese">점보 치즈</option><option value="Peach">복숭아</option></select><button id="coating">기본 코팅</button><button id="tool">손끝</button><button id="next" hidden>다음 →</button><button id="retryWax" hidden>다시 준비</button></div></div></div><div id="controls"><span id="keyboardHint">WASD / 방향키 이동</span><button id="interact" hidden>E · 개봉하기</button></div><div id="joystick" aria-label="이동 조이스틱"><div id="knob"></div></div><dialog id="menu"><div id="menuContent"></div><button id="closeMenu">계속 놀기</button></dialog>`;
}
export function updateHUD(g: Game, bench: boolean, done: boolean) {
  const s = g.s;
  $('coins').textContent = s.coins.toString();
  $('carry').textContent = `${s.carried} / ${g.capacity()}`;
  $('objective').textContent = bench
    ? `선반 ${s.shelf}개 · 기다리는 손님 ${s.customers.filter((c) => c.phase !== 'out').length}명`
    : s.carried
      ? '분홍색 원으로 가서 선반에 놓아요'
      : s.tray && !s.upgrades.runner
        ? '노란색 원에서 완성품을 들어요'
        : !s.made
          ? '민트색 원 → E로 첫 껍질을 열어요'
          : !s.upgrades.runner
            ? '60코인을 모아 운반 친구를 만나요'
            : !s.upgrades.expansion
              ? '90코인 → 두 번째 작업실을 열어요'
              : '나만의 말랑 공방! 부족한 재고를 도와주세요';
  $('benchHUD').hidden = !bench;
  $('controls').hidden = bench;
  $('joystick').hidden = bench;
  $('interact').hidden = bench || !g.near({ x: -3.7, z: -1.65 }, 1.15) || s.tray >= B.trayCapacity;
  $('next').hidden = !done;
  $('benchHint').textContent = done
    ? '말랑이 1개 완성! 트레이에 놓았어요'
    : '누르고 문지르기 · 돌려서 뒷면도 톡!';
}
export function growth(g: Game) {
  return `<h1>작은 공방, 한 걸음 더</h1><p>지금 ${g.s.coins} 코인</p><div class="upgrade-list">${upgrades.map(([id, title, description]) => `<button data-buy="${id}" ${g.s.upgrades[id] || g.s.coins < B.upgrades[id] || (id === 'runnerCarry' && !g.s.upgrades.runner) ? 'disabled' : ''}><span><b>${title}</b><small>${description}</small></span><strong>${g.s.upgrades[id] ? '완료' : B.upgrades[id] + ' W'}</strong></button>`).join('')}</div>`;
}
export function settings(g: Game) {
  return `<h1>잠깐, 쉬어 가요</h1><p>매장과 작업이 모두 멈췄어요</p><label><span>소리 끄기</span><input id="muted" type="checkbox" ${g.s.settings.muted ? 'checked' : ''}></label><label><span>효과음 크기</span><input id="volume" type="range" min="0" max="1" step=".05" value="${g.s.settings.volume}"></label><label><span>움직임 줄이기</span><input id="reduced" type="checkbox" ${g.s.settings.reduced ? 'checked' : ''}></label><label><span>가벼운 그래픽</span><input id="quality" type="checkbox" ${g.s.settings.quality === 'low' ? 'checked' : ''}></label><p class="help">이동 WASD / 방향키 · 작업 E<br>파쇄 누르기 / 드래그 · 돌리기 버튼<br>모바일: 왼쪽 스틱으로 이동<br>기기에 자동 저장 · 탭을 떠나면 일시정지</p><button id="reset" class="danger">새 공방 시작하기</button>`;
}
