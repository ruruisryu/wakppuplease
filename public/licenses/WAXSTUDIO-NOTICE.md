# 출처

- Three.js 0.180.0: MIT. `vendor/THREE-LICENSE.txt`에 원문 포함. 공식 npm 배포 파일을 jsDelivr로 받아 로컬에 보관했습니다.
- 모델: 이 저장소 `Assets/Scenes/WaxWorkbench.unity`가 참조하는 기존 버터/초콜릿/옥수수/망고/점보 치즈/복숭아 프리팹의 코어와 베이크된 WaxPlate 외면. 각 `assets/models/*.json`의 `sourcePrefab` 필드에 원본 경로가 있습니다. Unity의 +Z를 반전하고 삼각형 winding을 뒤집어 오른손 좌표계로 변환했습니다.
- 파쇄 소리: 기존 프로젝트 `Assets/SquishyShop/Audio/UserWax/`의 녹음 16개를 사용하는 Unity `WaxCrackleAudio`에서 직접 추출한 PCM입니다. 전체 원본 9개, 에너지 선택/경계 페이드를 적용한 짧은 구간 29개가 포함됩니다. `assets/audio/unity-audio.json`에 각 원본 경로와 구간 시작 프레임을 기록했습니다. 저장소의 사용자 제공 자산이며 새로운 라이선스를 부여하지 않습니다.
- 빗질/부스러기 소리: 기존 프로젝트 `WaxBroomTool.MakeSound`가 생성한 PCM 2개를 그대로 추출했습니다. 웹 재생 규칙도 `WaxCrackleAudio.cs`와 `WaxBroomTool.cs`에서 옮겼습니다.
- 인터페이스와 모델 선택 SVG는 이번 웹 구현용으로 작성했습니다. 폰트는 기기에 설치된 시스템 폰트를 사용합니다.
