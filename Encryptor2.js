// 自定义模运算，模拟Python的行为
function pythonMod(a, b) {
    return ((a % b) + b) % b;
}

// 文本转换为数值块
function textToBlock(text, blockSize = 48, textCharBlank=true, 
        validChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~') {
    const blocks = [];
    const validCharsLength = validChars.length + 1*(textCharBlank?1:0);
    const validCharsDict = {};
    for (let idx = 0; idx < validChars.length; idx++) {
        validCharsDict[validChars[idx]] = idx + 1*(textCharBlank?1:0);
    }
    
    // 计算每个块可以包含的字符数
    const textsPerBlock = Math.floor(blockSize * Math.log(2) / Math.log(validCharsLength) + 1e-15);
    
    // 预计算基数幂
    const multiplyBase = [1]; // validCharsLength^0
    for (let i = 1; i < textsPerBlock; i++) {
        multiplyBase.push(multiplyBase[i-1] * validCharsLength);
    }
    
    // 检查无效字符
    const invalidChars = new Set(text.split('').filter(c => !(c in validCharsDict)));
    if (invalidChars.size > 0) {
        throw new Error(`Invalid characters: ${Array.from(invalidChars).join(',')}`);
    }
    
    // 分块处理
    for (let i = 0; i < text.length; i += textsPerBlock) {
        const textInBlock = text.slice(i, i + textsPerBlock);
        let blockBit = 0;
        
        // 从右到左处理字符
        for (let charIdx = 0; charIdx < textInBlock.length; charIdx++) {
            const char = textInBlock[textInBlock.length - 1 - charIdx];
            blockBit += validCharsDict[char] * multiplyBase[charIdx];
        }
        
        blocks.push(blockBit);
    }
    
    return blocks;
}

// 数值块转换为文本
function blockToText(blocks, blockSize = 48, textCharBlank = true,
        validChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~') {
    const validCharsLength = validChars.length + 1*(textCharBlank?1:0);
    const logFactor = Math.log(2) / Math.log(validCharsLength);
    const textsPerBlock = Math.floor(blockSize * logFactor + 1e-15);
    
    // 预计算基数幂
    const multiplyBase = [1]; // validCharsLength^0
    for (let i = 1; i < textsPerBlock; i++) {
        multiplyBase.push(multiplyBase[i-1] * validCharsLength);
    }
    multiplyBase.reverse();
    
    const validCharsIndex = (textCharBlank?[null]:[]).concat(validChars.split(''));
    const text = [];
    
    for (const block of blocks) {
        let remaining = block;
        let blockText = [];
        
        for (const base of multiplyBase) {
            if (remaining === 0) break;
            
            let charIdx = Math.floor(remaining / base);
            remaining = pythonMod(remaining, base);
            
            let ok = 0;
            while (ok <= 0 && ok >= -5) {
                try {
                    if (charIdx !== 0 || !textCharBlank) {
                        blockText.push(validCharsIndex[charIdx]);
                    }
                    ok = 1;
                } catch (e) {
                    ok -= 1;
                    multiplyBase.push(multiplyBase[multiplyBase.length - 1] * validCharsLength);
                }
            }
        }
        if (!textCharBlank) {
            blockText = blockText.concat( validCharsIndex[0].repeat(textsPerBlock - blockText.length))
        }
        text.push(...blockText);
    }
    
    return text.join('');
}

// 十进制转任意进制
function decimalToBase(a, base) {
    if (a === 0) return [0];
    const digits = [];
    while (a > 0) {
        digits.push(a % base);
        a = Math.floor(a / base);
    }
    return digits.reverse(); // [MSB => LSB]
}

// 任意进制转十进制
function baseToDecimal(digits, base) {
    let result = 0;
    for (const digit of digits) {
        result = result * base + digit;
    }
    return result;
}

// 整数列表转十六进制字符串
function intListToHexString(intList, split = "-") {
    return intList.map(num => num.toString(16)).join(split);
}

// 十六进制字符串转整数列表
function hexStringToIntList(hexStr, split = "-") {
    return hexStr.split(split)
        .map(part => part ? parseInt(part, 16) : null)
        .filter(x => x !== null);
}

// 线性移位加密
function linearShiftForward(plainTextBlockList, keyBlockList, subBlockSize = 16) {
    const subBlockSpaces = 1 << subBlockSize; // 2^subBlockSize
    const mask = subBlockSpaces - 1;
    const cipherTextBlockList = [];
    
    for (const plainTextBlock of plainTextBlockList) {
        const plainTextBlocks = Array.isArray(plainTextBlock) ? plainTextBlock : [plainTextBlock];
        let plainTextSubblocks = [];
        
        for (const i of plainTextBlocks) {
            plainTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        const m = plainTextSubblocks.length;
        
        for (let round = 0; round < 1; round++) {
            for (let index = 0; index < keyBlockList.length; index++) {
                const i = keyBlockList[index];
                const tempIAdd = i + Math.floor(i / 3) + Math.floor(i / 17);
                const tempIndex = index + 1;
                
                // 预计算所有j的因子
                const factors = [];
                for (let j = 0; j < m; j++) {
                    factors.push(tempIndex * (j + 2));
                }
                
                for (let j = 0; j < m; j++) {
                    // 第一个操作
                    //plainTextSubblocks[j] = (plainTextSubblocks[j] + tempIAdd + factors[j]) & mask;
                    
                    // 如果j>0，执行第二个操作
                    if (j > 0||1) {
                        const prevVal = m-1? plainTextSubblocks[pythonMod(j - 1, m)] : 0;
                        const addTerm = i + factors[j] + prevVal;
                        plainTextSubblocks[j] = (plainTextSubblocks[j] + addTerm + tempIAdd) & mask;
                    }
                }
            }
        }
        
        cipherTextBlockList.push(plainTextSubblocks);
    }
    
    return cipherTextBlockList;
}

// 线性移位解密
function linearShiftBackward(cipherTextBlockList, keyBlockList, subBlockSize = 16) {
    const subBlockSpaces = 1 << subBlockSize; // 2^subBlockSize
    const mask = subBlockSpaces - 1;
    const plainTextBlockList = [];
    
    for (const cipherTextBlock of cipherTextBlockList) {
        const cipherTextBlocks = Array.isArray(cipherTextBlock) ? cipherTextBlock : [cipherTextBlock];
        let cipherTextSubblocks = [];
        
        for (const i of cipherTextBlocks) {
            cipherTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        const m = cipherTextSubblocks.length;
        
        for (let round = 0; round < 1; round++) {
            for (let index = keyBlockList.length - 1; index >= 0; index--) {
                const i = keyBlockList[index];
                const tempIAdd = i + Math.floor(i / 3) + Math.floor(i / 17);
                const tempIndex = index + 1;
                
                // 预计算所有j的因子
                const factors = [];
                for (let j = 0; j < m; j++) {
                    factors.push(tempIndex * (j + 2));
                }
                
                for (let j = m - 1; j >= 0; j--) {
                    // 反向第二个操作
                    if (j > 0 ||1) {
                        const prevVal = m-1? cipherTextSubblocks[pythonMod(j - 1, m)] : 0;
                        const addTerm = i + factors[j] + prevVal;
                        cipherTextSubblocks[j] = pythonMod(cipherTextSubblocks[j] -tempIAdd- addTerm, subBlockSpaces);
                    }
                    
                    // 反向第一个操作
                    //cipherTextSubblocks[j] = pythonMod(cipherTextSubblocks[j] - tempIAdd - factors[j], subBlockSpaces);
                }
            }
        }
        
        plainTextBlockList.push(cipherTextSubblocks);
    }
    
    return plainTextBlockList;
}

// 线性交换加密
function linearSwapForward(plainTextBlockList, keyBlockList, subBlockSize = 16) {
    const subBlockSpaces = 2 ** subBlockSize;
    const cipherTextBlockList = [];
    
    for (const plainTextBlock of plainTextBlockList) {
        const plainTextBlocks = Array.isArray(plainTextBlock) ? plainTextBlock : [plainTextBlock];
        let plainTextSubblocks = [];
        
        for (const i of plainTextBlocks) {
            plainTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        const subblocklen = plainTextSubblocks.length;
        if (subblocklen === 0) {
            //cipherTextBlockList.push([0]);
            continue;
        }
        
        const opralen = Math.floor(subblocklen / 10);
        const keyLen = keyBlockList.length;
        
        for (let index = 0; index < keyLen; index++) {
            const currentKey = keyBlockList[index];
            const maxJ = 4 + opralen + Math.floor(subblocklen/2);
            
            for (let j = 0; j < maxJ; j++) {
                const currentTemp = index + j;
                const modTemp = pythonMod(currentTemp, subblocklen);
                let factorA = pythonMod(modTemp * (modTemp + opralen), subblocklen);
                let factorB = pythonMod(currentTemp + 1 + currentKey, subblocklen);
                
                if (factorA !== 0 && factorB !== factorA - 1) {
                    const factorB2 = pythonMod(factorB + plainTextSubblocks[factorA - 1], subblocklen);
                    if (factorB2 !== factorA - 1) factorB = factorB2;
                }
                
                if (factorA !== factorB) {
                    // 交换元素
                    [plainTextSubblocks[factorA], plainTextSubblocks[factorB]] = 
                        [plainTextSubblocks[factorB], plainTextSubblocks[factorA]];
                }
            }
        }
        
        cipherTextBlockList.push(plainTextSubblocks);
    }
    
    return cipherTextBlockList;
}

// 线性交换解密
function linearSwapBackward(cipherTextBlockList, keyBlockList, subBlockSize = 16) {
    const subBlockSpaces = 2 ** subBlockSize;
    const plainTextBlockList = [];
    
    for (const cipherTextBlock of cipherTextBlockList) {
        const cipherTextBlocks = Array.isArray(cipherTextBlock) ? cipherTextBlock : [cipherTextBlock];
        let cipherTextSubblocks = [];
        
        for (const i of cipherTextBlocks) {
            cipherTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        const subblocklen = cipherTextSubblocks.length;
        if (subblocklen === 0) {
            //plainTextBlockList.push([0]);
            continue;
        }
        
        const opralen = Math.floor(subblocklen / 10);
        const keyLen = keyBlockList.length;
        
        for (let index = keyLen - 1; index >= 0; index--) {
            const currentKey = keyBlockList[index];
            const maxJ = 4 + opralen  + Math.floor(subblocklen/2);
            
            for (let j = maxJ - 1; j >= 0; j--) {
                const currentTemp = index + j;
                const modTemp = pythonMod(currentTemp, subblocklen);
                let factorA = pythonMod(modTemp * (modTemp + opralen), subblocklen);
                let factorB = pythonMod(currentTemp + 1 + currentKey, subblocklen);
                
                if (factorA !== 0 && factorB !== factorA - 1) {
                    const factorB2 = pythonMod(factorB + cipherTextSubblocks[factorA - 1], subblocklen);
                    if (factorB2 !== factorA - 1) factorB = factorB2;
                }
                
                if (factorA !== factorB) {
                    // 交换元素
                    [cipherTextSubblocks[factorA], cipherTextSubblocks[factorB]] = 
                        [cipherTextSubblocks[factorB], cipherTextSubblocks[factorA]];
                }
            }
        }
        
        plainTextBlockList.push(cipherTextSubblocks);
    }
    
    return plainTextBlockList;
}

// 构建S盒
function buildSbox(key, size = 256) {
    const gfSize = size; // 2^size
    const sbox = Array.from({length: gfSize}, (_, i) => i);
    
    // Fisher-Yates洗牌算法密钥化
    for (let i = gfSize - 1; i > 0; i--) {
        const keyIdx = pythonMod(key[i % key.length] + i, gfSize);
        [sbox[i], sbox[keyIdx]] = [sbox[keyIdx], sbox[i]];
    }
    
    return sbox;
}

// S盒加密
function sBoxForward(plainTextBlockList, keyBlockList, subBlockSize = 8) {
    const subBlockSpaces = 2 ** subBlockSize;
    const sBox = buildSbox(keyBlockList, subBlockSpaces);
    const cipherTextBlockList = [];
    
    for (const plainTextBlock of plainTextBlockList) {
        const plainTextBlocks = Array.isArray(plainTextBlock) ? plainTextBlock : [plainTextBlock];
        let plainTextSubblocks = [];
        
        for (const i of plainTextBlocks) {
            plainTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        // 行移位变换
        const numRows = Math.floor(plainTextSubblocks.length / 4);
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            const start = rowIdx * 4;
            const end = start + 4;
            const row = plainTextSubblocks.slice(start, end);
            const shift = rowIdx % 4;
            const shiftedRow = shift !== 0 ? row.slice(-shift).concat(row.slice(0, -shift)) : row;
            plainTextSubblocks.splice(start, 4, ...shiftedRow);
        }
        
        const cipherTextSubblocks = [];
        for (const subblock of plainTextSubblocks) {
            cipherTextSubblocks.push(sBox[subblock]);
        }
        
        cipherTextBlockList.push(cipherTextSubblocks);
    }
    
    return cipherTextBlockList;
}

// S盒解密
function sBoxBackward(cipherTextBlockList, keyBlockList, subBlockSize = 8) {
    const subBlockSpaces = 2 ** subBlockSize;
    const sBox = buildSbox(keyBlockList, subBlockSpaces);
    const reverseSBox = Array.from({length: sBox.length}, (_, x) => sBox.indexOf(x));
    const plainTextBlockList = [];
    
    for (const cipherTextBlock of cipherTextBlockList) {
        const cipherTextBlocks = Array.isArray(cipherTextBlock) ? cipherTextBlock : [cipherTextBlock];
        let cipherTextSubblocks = [];
        
        for (const i of cipherTextBlocks) {
            cipherTextSubblocks.push(...decimalToBase(i, subBlockSpaces));
        }
        
        const plainTextSubblocks = [];
        for (const subblock of cipherTextSubblocks) {
            plainTextSubblocks.push(reverseSBox[subblock]);
        }
        
        // 逆行移位变换
        const numRows = Math.floor(plainTextSubblocks.length / 4);
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
            const start = rowIdx * 4;
            const end = start + 4;
            const row = plainTextSubblocks.slice(start, end);
            const shift = rowIdx % 4;
            const originalRow = shift !== 0 ? row.slice(shift).concat(row.slice(0, shift)) : row;
            plainTextSubblocks.splice(start, 4, ...originalRow);
        }
        
        plainTextBlockList.push(plainTextSubblocks);
    }
    
    return plainTextBlockList;
}

// 密钥扩展
function keyExpansion(masterKey, rounds = 3) {
    function diffusion(arr) {
        return arr.map(x => (x * 0x15D + (x >>> 3)) & 0xFFFF);
    }
    
    let expandedKey = [...masterKey];
    const xorShiftFactor = Math.min(3, expandedKey.length - 2);
    
    for (let round = 0; round < rounds; round++) {
        expandedKey = diffusion(expandedKey);
        if (xorShiftFactor > 0) {
            expandedKey = expandedKey.map((_, i) => 
                expandedKey[(i + xorShiftFactor) % expandedKey.length] ^ expandedKey[i]);
        }
    }
    
    return expandedKey;
}

// 生成处理流程
function generateProcesses(keyBlocks, pool = null) {
    if (pool === null) {
        pool = {0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2};
    }
    
    const hashSeed = keyBlocks.map((k, i) => k * (i + 1));
    const poolList = [];
    for (const [k, v] of Object.entries(pool)) {
        for (let i = 0; i < v; i++) {
            poolList.push(parseInt(k));
        }
    }
    
    const indexes = buildSbox(hashSeed, poolList.length);
    return indexes.map(i => poolList[i]);
}

function reverseSubblock(blockList) {
    return blockList.map(i => i.reverse());
}

// 加密位块
function encryptBitblock(plainBitblockList, keyBlockList, subBlockSize = 8) {
    const subBlockSpace = 2 ** subBlockSize;
    const key0 = keyExpansion(keyBlockList);
    
    const defaultKey = [
        50524, 15702, 39651, 6295, 28348, 12071, 35661, 24141,
        668, 55643, 52851, 62390, 27290, 6457, 47093, 44059,
        43598, 34032, 50543, 5357, 14609, 24947, 28090, 1781,
        50795, 30647, 35077, 56306, 37512, 41124, 19279, 43475,
        52403, 730, 43513, 33090, 58988, 20101, 65008, 14513,
        38901, 20626, 62788, 13864, 44670, 12842, 6564, 26644,
        42699, 31359, 31127, 15088, 45717, 57093, 63113, 30010,
        15897, 13744, 405, 50, 1302, 15370, 4377, 8190
    ].slice(0, Math.max(Math.floor(256 / subBlockSize), 16));
    let key1 = linearShiftForward(defaultKey, key0, subBlockSize * 2);
    key1 = key1.map(i => baseToDecimal(i.slice(0, 1), subBlockSpace));

    let key2 = linearSwapForward(key1, [...key1, 35, 215, 221, 84, 79, 144], Math.floor(subBlockSize / 2));
    key2 = key2.map(i => baseToDecimal(i.slice(0, 4), 2 ** (Math.floor(subBlockSize / 2))));
    
    let key3 = sBoxForward(key2, key1, subBlockSize);
    key3 = key3.map(i => baseToDecimal(i.slice(0, 1), subBlockSpace));
    
    const swapForward = linearSwapForward(key3, key2, Math.floor(subBlockSize / 4));
    const swapForwardDecimal = swapForward.map(i => baseToDecimal(i, subBlockSpace));
    const processes = [0, 3, 1, 2].concat(
        generateProcesses(swapForwardDecimal, { ...{ 0: 1, 1: 1 }, ...{ 2: 2, 3: 2 }})
    );
    let cipherBitblockList = plainBitblockList;
    let keys = [key3];
    for (const process of processes) {
        let k = linearShiftForward(keys[keys.length - 1], [...keys[keys.length - 1], process], subBlockSize);
        keys.push(k.map(i => baseToDecimal(i, subBlockSpace)));
    }
    for (let i = 0; i < processes.length; i++) {
        const process = processes[i];
        const currentKey = keys[i + 1];
        
        if (process === 0) {
            cipherBitblockList = linearShiftForward(cipherBitblockList, currentKey, subBlockSize);
        } else if (process === 1) {
            cipherBitblockList = reverseSubblock(cipherBitblockList);
            cipherBitblockList = linearShiftForward(cipherBitblockList, currentKey, subBlockSize);
        } else if (process === 2) {
            cipherBitblockList = sBoxForward(cipherBitblockList, currentKey, subBlockSize);
            cipherBitblockList = linearSwapForward(cipherBitblockList, currentKey, subBlockSize);
        } else if (process === 3) {
            cipherBitblockList = reverseSubblock(cipherBitblockList);
            cipherBitblockList = sBoxForward(cipherBitblockList, currentKey, subBlockSize);
            cipherBitblockList = linearSwapForward(cipherBitblockList, currentKey, subBlockSize);
        } else if (process === 5) {
            cipherBitblockList = linearSwapForward(cipherBitblockList, currentKey, subBlockSize);
        }
    }
    
    return cipherBitblockList;
}

// 解密位块
function decryptBitblock(cipherBitblockList, keyBlockList, subBlockSize = 8) {
    const subBlockSpace = 2 ** subBlockSize;
    const key0 = keyExpansion(keyBlockList);
    
    const defaultKey = [
        50524, 15702, 39651, 6295, 28348, 12071, 35661, 24141,
        668, 55643, 52851, 62390, 27290, 6457, 47093, 44059,
        43598, 34032, 50543, 5357, 14609, 24947, 28090, 1781,
        50795, 30647, 35077, 56306, 37512, 41124, 19279, 43475,
        52403, 730, 43513, 33090, 58988, 20101, 65008, 14513,
        38901, 20626, 62788, 13864, 44670, 12842, 6564, 26644,
        42699, 31359, 31127, 15088, 45717, 57093, 63113, 30010,
        15897, 13744, 405, 50, 1302, 15370, 4377, 8190
    ].slice(0, Math.max(Math.floor(256 / subBlockSize), 16));
    let key1 = linearShiftForward(defaultKey, key0, subBlockSize * 2);
    key1 = key1.map(i => baseToDecimal(i.slice(0, 1), subBlockSpace));

    let key2 = linearSwapForward(key1, [...key1, 35, 215, 221, 84, 79, 144], Math.floor(subBlockSize / 2));
    key2 = key2.map(i => baseToDecimal(i.slice(0, 4), 2 ** (Math.floor(subBlockSize / 2))));
    
    let key3 = sBoxForward(key2, key1, subBlockSize);
    key3 = key3.map(i => baseToDecimal(i.slice(0, 1), subBlockSpace));
    
    const swapForward = linearSwapForward(key3, key2, Math.floor(subBlockSize / 4));
    const swapForwardDecimal = swapForward.map(i => baseToDecimal(i, subBlockSpace));
    const processes = [0, 3, 1, 2].concat(
        generateProcesses(swapForwardDecimal, { ...{ 0: 1, 1: 1 }, ...{ 2: 2, 3: 2 }})
    );
    let plainBitblockList = cipherBitblockList;
    let keys = [key3];
    for (const process of processes) {
        let k = linearShiftForward(keys[keys.length - 1], [...keys[keys.length - 1], process], subBlockSize);
        keys.push(k.map(i => baseToDecimal(i, subBlockSpace)));
    }
    
    for (let i = processes.length - 1; i >= 0; i--) {
        const process = processes[i];
        const currentKey = keys[i + 1];
        if (process === 0) {
            plainBitblockList = linearShiftBackward(plainBitblockList, currentKey, subBlockSize);
        } else if (process === 1) {
            plainBitblockList = linearShiftBackward(plainBitblockList, currentKey, subBlockSize);
            plainBitblockList = reverseSubblock(plainBitblockList);
        } else if (process === 2) {
            plainBitblockList = linearSwapBackward(plainBitblockList, currentKey, subBlockSize);
            plainBitblockList = sBoxBackward(plainBitblockList, currentKey, subBlockSize);
        } else if (process === 3) {
            plainBitblockList = linearSwapBackward(plainBitblockList, currentKey, subBlockSize);
            plainBitblockList = sBoxBackward(plainBitblockList, currentKey, subBlockSize);
            plainBitblockList = reverseSubblock(plainBitblockList);
        } else if (process === 5) {
            // plainBitblockList = linearSwapBackward(plainBitblockList, currentKey, subBlockSize);
        }
    }
    
    return plainBitblockList;
}

// 加密文本
function encryptText(text, key, blockSize = 48, subBlockSize = 8, textCharBlank=true,
    validTextChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
    validKeyChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~') {
    
    const msg = textToBlock(text, blockSize, textCharBlank, validTextChars);
    let cipher;
    if(key===null){cipher = msg.map(i => decimalToBase(i, Math.pow(2, subBlockSize)));}
    else{const k = textToBlock(key, Math.min(blockSize, 16), true, validKeyChars);
    cipher = encryptBitblock(msg, k, subBlockSize);}
    const cipherHexList = cipher.map(i => intListToHexString(i, "-"));
    return cipherHexList.join(".");
}

// 解密文本
function decryptText(cipher, key, blockSize = 48, subBlockSize = 8, textCharBlank=true,
    validTextChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
    validKeyChars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~') {
    
    const cipherHexList = cipher.split(".");
    const cipherBlocks = cipherHexList.map(i => hexStringToIntList(i, "-"));
    let decimalMsg;
    if(key===null){decimalMsg = cipherBlocks.map(i => baseToDecimal(i, Math.pow(2, subBlockSize)));}
    else{
        const k = textToBlock(key, Math.min(blockSize, 16), true, validKeyChars);
        const msg = decryptBitblock(cipherBlocks, k, subBlockSize);
        decimalMsg = msg.map(i => baseToDecimal(i, 2 ** subBlockSize));    
    }
    return blockToText(decimalMsg, blockSize, textCharBlank, validTextChars);
}