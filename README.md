# Pocket Study

모바일 학습용 웹앱. 영어(단어, 회화, 패턴)와 CS 지식을 플래시카드 형태로 공부할 수 있다.

**배포 URL**: https://kimdasomxkimdasom.github.io/pocket-study/

## 기술 스택

- **Backend**: Node.js + Express + TypeScript (로컬 개발용)
- **Frontend**: HTML / CSS / Vanilla JS
- **데이터**: JSON 파일 (DB 미사용)
- **학습 기록**: 브라우저 localStorage
- **배포**: GitHub Pages (`/docs` 폴더)

## 프로젝트 구조

```
pocket-study/
├── src/
│   └── app.ts                 # Express 서버 (로컬 개발용)
├── public/                    # 프론트엔드 소스
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js
│   └── data/                  # 학습 데이터
│       ├── english_word.json
│       ├── english_conversation.json
│       ├── english_pattern.json
│       └── cs.json
├── docs/                      # GitHub Pages 배포용 (public/ 복사본)
├── package.json
└── tsconfig.json
```

## 로컬 실행

```bash
npm install
npm run dev       # 개발 모드 (ts-node + nodemon)
npm run build     # TypeScript 빌드
npm start         # 빌드된 JS 실행
```

http://localhost:3000 에서 확인.

## 학습 데이터 추가/수정

`public/data/` 안의 JSON 파일을 직접 편집한다.

```json
{
  "id": 4,
  "front": "facilitate",
  "back": "촉진하다, 용이하게 하다",
  "example": "The software facilitates team collaboration.",
  "sub": "비즈니스"
}
```

| 필드 | 설명 | 필수 |
|------|------|------|
| `id` | 고유 번호 | O |
| `front` | 앞면 (질문/단어) | O |
| `back` | 뒷면 (답/뜻) | O |
| `example` | 예문 | X |
| `sub` | 세부 카테고리 | X |

## 배포 (GitHub Pages)

### 초기 설정

1. GitHub repo Settings > Pages
2. Source: Deploy from a branch
3. Branch: `main` / 폴더: `/docs`
4. Save

### 데이터 수정 후 배포

`public/`의 내용을 수정한 뒤 `docs/`에 반영하고 push한다.

```bash
# 1. public/ 수정 후 docs/에 복사
cp -r public/* docs/

# 2. 커밋 & 푸시
git add .
git commit -m "Update study data"
git push
```

1~2분 후 배포 URL에 반영된다.

## 주요 기능

- **플래시카드 퀴즈**: 카드를 탭하면 뒤집어서 답 확인
- **학습 기록**: 정답/오답 횟수를 localStorage에 저장
- **4개 카테고리**: 영어 단어, 영어 회화, 영어 패턴, CS 공부
- **모바일 최적화**: 다크 테마, 터치 친화적 UI
