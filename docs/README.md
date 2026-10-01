# 왁뿌 매장 운영 기획

status: implementation
updated: 2026-10-01
summary: 선행 기획 A안을 바탕으로 Three.js 웹게임을 구현했다. 실제 적용 규칙과 검증은 아래 구현 문서를 따른다.

- [공개 게임](https://ruruisryu.github.io/wakppuplease/): GitHub Pages 배포 및 실제 공개 플레이 확인 완료.

- [구현 결정](implementation.md): 실행 코드에 적용한 규칙·아트·입력·저장·Unity 이식 경계.
- [검증 결과](verification.md): 로컬과 공개 배포 검증 결과 및 한계.

- [레퍼런스 분석과 상세 기획](wax-shop-design.md): 추천안, 세 결합안 비교, 운영·입력·경제, 첫 10분, 비교 실험, 웹에서 Unity로 이어질 경계, 출처와 한계.
- 기존 `WAKPPU_clicker`는 읽기 전용으로 조사했다. 현재 구현 기준은 `web/claude/v0.9.0`이며, 신규 게임의 플랫폼·수치·규칙을 확정하는 근거로 간주하지 않는다.
- 문서의 수치는 명시한 기존 코드 관찰값 외에는 모두 프로토타입 가설이다. 사람의 재미 검증 결과가 아니다.
