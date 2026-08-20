#!/bin/bash
set -e

echo "▶ Toss 번들 빌드 시작"

BACKUP_DIR="/tmp/jumechu-api-backup-$$"

# API 라우트 임시 제거 (static export 호환, TypeScript 스캔 제외)
if [ -d "app/api" ]; then
  mv app/api "$BACKUP_DIR"
  echo "  → app/api 임시 제거 ($BACKUP_DIR)"
fi

restore() {
  if [ -d "$BACKUP_DIR" ]; then
    mv "$BACKUP_DIR" app/api
    echo "  → app/api 복원 완료"
  fi
}

trap restore EXIT

# Next.js static export 빌드
echo "  → next build (output: export)"
TOSS_BUNDLE=true NEXT_PUBLIC_API_BASE_URL=https://jumechu.vercel.app npx next build

# .ait 번들 생성
echo "  → ait build"
npx ait build

echo "✓ 빌드 완료"
