#!/usr/bin/env bash
# 決まったディレクトリ構成から、sample.tar / sample.tar.gz / sample.tar.xzを
# 作り直す。リポジトリのルートで実行する: bash api/lib/test-fixtures/build.sh
set -euo pipefail
cd "$(dirname "$0")"

# macOSのtarが`._*`のAppleDouble（リソースフォーク）のエントリをアーカイブに
# 入れないようにする。入ると、OSをまたいでテストのフィクスチャが汚れる。
export COPYFILE_DISABLE=1

mkdir -p tmp/d
printf 'alpha\n'        > tmp/d/a.txt
printf 'beta-beta\n'    > tmp/d/b.txt
printf 'gamma-gamma\n'  > tmp/d/c.txt

tar -cf  sample.tar    -C tmp d
tar -czf sample.tar.gz -C tmp d
tar -cJf sample.tar.xz -C tmp d

rm -rf tmp
