# Glitchsnap 배포 가이드

Glitchsnap Electron 앱을 macOS/Windows용으로 빌드하고 배포하는 전체 과정을 정리한 문서입니다.

---

## 목차

1. [배포 아키텍처 개요](#1-배포-아키텍처-개요)
2. [사전 준비 (Apple 개발자 계정)](#2-사전-준비-apple-개발자-계정)
3. [GitHub Secrets 설정](#3-github-secrets-설정)
4. [자동 배포 (CI/CD)](#4-자동-배포-cicd)
5. [수동 로컬 빌드](#5-수동-로컬-빌드)
6. [코드 서명 & 공증 (Notarization)](#6-코드-서명--공증-notarization)
7. [배포 산출물](#7-배포-산출물)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. 배포 아키텍처 개요

```
main 브랜치 push
       │
       ▼
  ┌─────────────┐
  │ bump-version │  ← patch 버전 자동 증가 + git tag 생성
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │    build     │  ← macOS / Windows 병렬 빌드
  │  (matrix)    │
  └──────┬──────┘
         │
    ┌────┴────┐
    ▼         ▼
 macOS    Windows
    │         │
    ▼         ▼
 GitHub Releases (draft) + S3 업로드
         │
         ▼
  ┌─────────────┐
  │   publish    │  ← draft → published 전환
  └─────────────┘
```

**사용 도구:**
- **빌드**: `electron-vite` (Vite 기반 Electron 빌드)
- **패키징**: `electron-builder` (DMG, NSIS, AppImage 등 생성)
- **CI/CD**: GitHub Actions (`.github/workflows/release.yml`)
- **배포 채널**: GitHub Releases + AWS S3 (`glitchsnap-releases` 버킷)

---

## 2. 사전 준비 (Apple 개발자 계정)

### 2-1. Apple Developer Program 가입

- [developer.apple.com](https://developer.apple.com) 에서 개발자 계정 등록 (연 $99)
- Apple Developer Program에 가입되어 있어야 코드 서명 및 공증이 가능

### 2-2. 코드 서명 인증서 생성

1. **Xcode** 또는 [Apple Developer 포털](https://developer.apple.com/account/resources/certificates/list)에서 인증서 생성
2. **Developer ID Application** 인증서를 선택 (Mac 앱 배포용)
3. 키체인 접근(Keychain Access)에서 인증서가 설치되었는지 확인

### 2-3. 인증서를 `.p12` 파일로 내보내기

```bash
# 키체인 접근 앱에서:
# 1. "내 인증서" 탭에서 "Developer ID Application: ..." 인증서를 선택
# 2. 오른쪽 클릭 → "내보내기"
# 3. .p12 형식으로 저장 (비밀번호 설정 필수)
```

### 2-4. `.p12`를 Base64로 인코딩

```bash
base64 -i Certificates.p12 -o cert-base64.txt
```

이 값이 GitHub Secrets의 `APPLE_CERT_BASE64`에 들어갑니다.

### 2-5. 앱 전용 비밀번호 생성

Apple 공증(notarization)에 필요합니다:

1. [appleid.apple.com](https://appleid.apple.com) 접속
2. "로그인 및 보안" → "앱 전용 비밀번호"
3. 비밀번호 생성 (예: `glitchsnap-notarize`)
4. 생성된 비밀번호를 `APPLE_APP_SPECIFIC_PASSWORD`로 저장

### 2-6. Team ID 확인

```bash
# Apple Developer 포털 → Membership Details에서 Team ID 확인
# 또는 터미널에서:
security find-identity -v -p codesigning
# 출력 예: "Developer ID Application: Your Name (XXXXXXXXXX)"
# 괄호 안의 XXXXXXXXXX가 Team ID
```

---

## 3. GitHub Secrets 설정

Repository → Settings → Secrets and variables → Actions에서 아래 시크릿을 등록합니다.

### Apple 코드 서명 관련

| Secret 이름 | 설명 | 예시 |
|---|---|---|
| `APPLE_CERT_BASE64` | `.p12` 인증서를 Base64 인코딩한 값 | (긴 문자열) |
| `APPLE_CERT_PASSWORD` | `.p12` 내보내기 시 설정한 비밀번호 | `my-cert-password` |
| `APPLE_ID` | Apple 개발자 계정 이메일 | `dev@example.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | 앱 전용 비밀번호 | `xxxx-xxxx-xxxx-xxxx` |
| `APPLE_TEAM_ID` | Apple Developer Team ID | `XXXXXXXXXX` |

### 앱 환경 변수

| Secret 이름 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anonymous Key |
| `VITE_MISTRAL_API_KEY` | Mistral AI API 키 |
| `VITE_RESEND_API_KEY` | Resend 이메일 API 키 |
| `AUTO_UPDATE_TOKEN` | 자동 업데이트용 GitHub Token |

### AWS S3 관련

| Secret 이름 | 설명 |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Key |

> S3 버킷: `glitchsnap-releases` (리전: `ap-northeast-2`)

---

## 4. 자동 배포 (CI/CD)

### 배포 트리거

**`main` 브랜치에 push하면 자동으로 배포가 시작됩니다.**

```bash
# 예: feature 브랜치를 main에 머지
git checkout main
git merge feature/my-feature
git push origin main
# → GitHub Actions release.yml 워크플로우가 자동 실행
```

### 워크플로우 단계

#### Step 1: 버전 자동 증가 (`bump-version`)
- `package.json`의 patch 버전을 자동으로 +1 증가
- 예: `1.1.38` → `1.1.39`
- `v1.1.39` git tag 생성 및 push

#### Step 2: 빌드 (`build`)
- macOS와 Windows를 **병렬**로 빌드
- macOS: 코드 서명 인증서 임포트 → 빌드 → 공증 → GitHub Releases 업로드
- Windows: 빌드 → GitHub Releases 업로드
- 빌드 산출물을 S3에도 업로드

#### Step 3: 릴리스 발행 (`publish`)
- GitHub Release를 draft에서 published로 전환

### 빌드 상태 확인

```bash
# GitHub CLI로 워크플로우 실행 상태 확인
gh run list --workflow=release.yml

# 특정 실행의 상세 로그
gh run view <run-id> --log
```

---

## 5. 수동 로컬 빌드

CI/CD 없이 로컬에서 직접 빌드하는 방법입니다.

### macOS 빌드

```bash
# 1. 환경 변수 설정
export VITE_SUPABASE_URL="..."
export VITE_SUPABASE_ANON_KEY="..."
export VITE_MISTRAL_API_KEY="..."
export VITE_RESEND_API_KEY="..."
export MAIN_VITE_AUTO_UPDATE_TOKEN="..."

# 2. 빌드 (코드 서명은 키체인에 인증서가 있으면 자동 적용)
pnpm run build:mac

# 산출물 위치: dist/ 폴더
# - Glitchsnap-{version}.dmg (Apple Silicon)
# - Glitchsnap-{version}-x64.dmg (Intel)
```

### 공증 포함 빌드 (로컬)

```bash
# Apple 공증 환경 변수 추가 설정
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

# 공증 활성화하여 빌드
npx electron-builder --mac -c.mac.notarize=true
```

> `electron-builder.yml`에서 `notarize: false`로 설정되어 있으므로, 로컬에서 공증을 원할 경우 `-c.mac.notarize=true` 플래그를 추가해야 합니다.

### Windows 빌드

```bash
pnpm run build:win
# 산출물: dist/Glitchsnap-{version}-setup.exe
```

---

## 6. 코드 서명 & 공증 (Notarization)

### 코드 서명이 필요한 이유

- macOS Gatekeeper가 서명되지 않은 앱의 실행을 차단함
- 사용자가 "확인되지 않은 개발자" 경고 없이 앱을 사용할 수 있음

### 공증(Notarization)이 필요한 이유

- macOS 10.15 (Catalina) 이후 공증이 사실상 필수
- Apple 서버에 앱을 제출하여 악성코드 검사를 통과해야 함
- 공증 완료 후 앱에 "스테이플(staple)"이 부착됨

### CI/CD에서의 서명 과정

`release.yml`에서 자동으로 처리됩니다:

```yaml
# 1. p12 인증서 디코딩 → 임시 키체인 생성 → 인증서 임포트
echo "$APPLE_CERT_BASE64" | base64 --decode > cert.p12
security create-keychain -p "" app-signing.keychain-db
security import cert.p12 -P "$APPLE_CERT_PASSWORD" -A -t cert -f pkcs12 -k app-signing.keychain-db

# 2. electron-builder가 자동으로 서명 + 공증 수행
npx electron-builder --mac --publish always -c.mac.notarize=true
```

### Entitlements (권한 설정)

`build/entitlements.mac.plist`에 정의된 앱 권한:

| 권한 | 설명 |
|---|---|
| `com.apple.security.cs.allow-jit` | JIT 컴파일 허용 (Electron 필수) |
| `com.apple.security.cs.allow-unsigned-executable-memory` | 서명되지 않은 실행 메모리 허용 |
| `com.apple.security.cs.allow-dyld-environment-variables` | DYLD 환경변수 허용 |

### 추가 Info.plist 설정

`electron-builder.yml`의 `mac.extendInfo`에서 설정:

- 카메라 접근 권한 (`NSCameraUsageDescription`)
- 마이크 접근 권한 (`NSMicrophoneUsageDescription`)
- 문서 폴더 접근 권한 (`NSDocumentsFolderUsageDescription`)
- 다운로드 폴더 접근 권한 (`NSDownloadsFolderUsageDescription`)

---

## 7. 배포 산출물

### GitHub Releases

각 릴리스에 아래 파일들이 업로드됩니다:

| 파일 | 플랫폼 | 설명 |
|---|---|---|
| `Glitchsnap-{version}.dmg` | macOS (Apple Silicon) | DMG 설치 파일 |
| `Glitchsnap-{version}-x64.dmg` | macOS (Intel) | Intel Mac용 DMG |
| `Glitchsnap-{version}-setup.exe` | Windows | NSIS 설치 파일 |
| `latest-mac.yml` | - | 자동 업데이트 메타데이터 |
| `latest.yml` | - | Windows 자동 업데이트 메타데이터 |

### S3 버킷 구조

```
s3://glitchsnap-releases/
├── v1.1.39/
│   ├── Glitchsnap-1.1.39.dmg
│   ├── Glitchsnap-1.1.39-x64.dmg
│   ├── Glitchsnap-1.1.39-setup.exe
│   └── Glitchsnap-1.1.39.msi
├── latest/
│   ├── Glitchsnap_macos_aarch64.dmg
│   ├── Glitchsnap_macos_x64.dmg
│   ├── Glitchsnap_windows.exe
│   └── Glitchsnap_windows.msi
└── ...
```

- `latest/` 폴더는 항상 최신 버전으로 덮어씌워짐
- 버전별 폴더에 이력 보관

---

## 8. 트러블슈팅

### "확인되지 않은 개발자" 경고가 뜨는 경우

- 공증(notarization)이 정상적으로 완료되었는지 확인
- CI 로그에서 `notarize` 단계 확인
- 로컬 빌드 시 `-c.mac.notarize=true` 플래그 확인

```bash
# 앱이 공증되었는지 확인
spctl -a -vvv /path/to/Glitchsnap.app
# 출력에 "source=Notarized Developer ID" 포함되어야 함
```

### 코드 서명 실패

```bash
# 유효한 서명 인증서가 있는지 확인
security find-identity -v -p codesigning

# Developer ID Application 인증서가 목록에 있어야 함
# 만료된 인증서는 Apple Developer 포털에서 갱신
```

### 빌드 시 환경 변수 누락

CI에서 빌드 실패 시 GitHub Secrets가 모두 등록되어 있는지 확인:

```bash
# Repository Settings → Secrets and variables → Actions
# 필수 시크릿 목록 확인
```

### electron-builder 캐시 문제

```bash
# 캐시 삭제 후 재빌드
rm -rf ~/Library/Caches/electron-builder
rm -rf node_modules
pnpm install
pnpm run build:mac
```

### S3 업로드 실패

- AWS IAM 사용자에 `s3:PutObject` 권한이 `glitchsnap-releases` 버킷에 대해 있는지 확인
- AWS 리전이 `ap-northeast-2`인지 확인

---

## 주요 설정 파일 참조

| 파일 | 용도 |
|---|---|
| `electron-builder.yml` | electron-builder 빌드 설정 (앱 ID, 타겟, 서명 등) |
| `build/entitlements.mac.plist` | macOS 앱 권한 (entitlements) |
| `.github/workflows/release.yml` | CI/CD 자동 배포 워크플로우 |
| `.github/workflows/build.yml` | PR 빌드 검증 워크플로우 |
| `package.json` | 빌드 스크립트 (`build:mac`, `build:win` 등) |
