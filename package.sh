#!/bin/bash
set -e

if [ $# -ne 1 ]; then
    echo "Provide version as the first argument (patch, minor, major etc.)"
    exit 2
fi

VERSION=$1

echo "Setting version to $VERSION..."
#npm version "$VERSION" --no-git-tag-version --allow-same-version
cd server
npm version "$VERSION" --no-git-tag-version --allow-same-version
cd ../client
npm version "$VERSION" --no-git-tag-version --allow-same-version
cd ..

echo "Building client..."
cd client
npm run build
cd ..

echo "Building server..."
cd server
npm run build

echo "Copying client assets to server asset folder..."
rm -rf front-dist/
mkdir front-dist/
cp -r ../client/dist/* front-dist/

echo "Packaging with pkg..."
rm -rf build/
./node_modules/.bin/pkg .

cd ..
echo "Done?"
