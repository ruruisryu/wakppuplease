# 왁뿌! 말랑 공방

매장을 걸어 다니며 왁스 껍질을 열고, 말랑이를 운반해 손님에게 건네는 3D 브라우저 게임.

**[바로 플레이 — GitHub Pages](https://ruruisryu.github.io/wakppuplease/)**

공개 사이트에서 실제 이동·파쇄·운반·판매·저장 복원을 검증했습니다.

```powershell
npm ci
npm run dev
# http://127.0.0.1:5173

npm test
npm run build
npm run preview
# http://127.0.0.1:4173
```

PC: WASD/방향키 이동, 민트색 원에서 E 작업, 누르고 드래그해 파쇄, 돌리기 버튼으로 반대 면. 완성 후 매장으로 돌아와 노란 원에서 집고 분홍 원에 전달. 모바일: 왼쪽 스틱과 작업 버튼. ESC/Ⅱ는 일시정지·설정. 코인은 고객 인도 후에만 지급된다.

성장 창에서 트레이 강화, 운반 직원, 두 번째 작업실을 구매한다. 저장은 현재 브라우저 기기 안에서만 이루어진다. 숨겨진 탭과 종료 중에는 진행하지 않는다.

- [구현 결정과 구조](docs/implementation.md)
- [검증 결과](docs/verification.md)
- [선행 기획](docs/wax-shop-design.md)
- [자산 출처](public/licenses/ASSET-NOTICE.md)
- 규칙: `src/game/simulation.ts`, 밸런스: `src/game/balance.json`, 월드: `src/render/world.ts`, 파쇄: `src/render/wax.ts`
- 브라우저 검증: `scripts/play-*.cjs`는 Playwright CLI `run-code --filename`에 전달. 읽기 전용 `window.__wakppu` 진단으로 상태를 확인하며 일반 입력으로 플레이한다.

GitHub Pages: 원격 저장소의 Pages source를 **GitHub Actions**로 설정하고 main 브랜치에 푸시하면 워크플로가 실행된다. `dist`가 정적 산출물이며 개발 서버가 필요 없다. 배포 성공·공개 URL 검증 전에는 로컬 빌드 완료를 공개 배포로 간주하지 않는다.
