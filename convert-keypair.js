const fs = require('fs');

// Base58の秘密鍵
const secretKeyBase58 = "5QGviA7bCQNvyAkCPvh6Ee4wRNPTVpskXZYE1pvF8rJyDiTfFotn6QYMqbtKZkAyZPFQ9nNWcTV6DMtcS4mRYjMn";

// bs58ライブラリがなければインストールが必要です
try {
  require.resolve('bs58');
} catch (err) {
  console.error('bs58ライブラリがインストールされていません。インストールしてください:');
  console.error('npm install bs58');
  process.exit(1);
}

const bs58 = require('bs58');

// Base58からバイト配列に変換
const secretKeyBytes = bs58.decode(secretKeyBase58);

// 数値配列に変換
const secretKeyArray = Array.from(secretKeyBytes);

// JSONファイルに書き込み
fs.writeFileSync('keypair.json', JSON.stringify(secretKeyArray));

console.log('秘密鍵をkeypair.jsonに変換しました'); 