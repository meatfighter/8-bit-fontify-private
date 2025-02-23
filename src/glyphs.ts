import { promises as fsPromises } from 'fs';
import sharp from 'sharp';

const FONTS_DIR = "C:/js-projects/8-bit-fontify-private/fonts";

const glyphs: boolean[][][] = [];
const glyphsSet = new Set<string>();

function readPixel(data: Buffer, width: number, x: number, y: number): boolean {
    return data[3 * (width * y + x)] > 0x7F;
}

function readGlyph(data: Buffer, width: number, x: number, y: number): boolean[][] | undefined {
    const glyph: boolean[][] = new Array<boolean[]>(8);
    for (let i = 0; i < 8; ++i) {
        glyph[i] = new Array<boolean>(8);
        for (let j = 0; j < 8; ++j) {
            glyph[i][j] = readPixel(data, width, x + j, y + i);
        }
    }

    let firstColumn = false;
    for (let i = 0; i < 8; ++i) {
        if (glyph[i][0]) {
            firstColumn = true;
            break;
        }
    }

    let lastColumn = false;
    for (let i = 0; i < 8; ++i) {
        if (glyph[i][7]) {
            lastColumn = true;
            break;
        }
    }

    if (firstColumn && lastColumn) {
        return undefined;
    }

    if (!firstColumn && lastColumn) {
        for (let i = 0; i < 8; ++i) {
            const row = glyph[i];
            for (let j = 0; j < 7; ++j) {
                row[j] = row[j + 1];
            }
            row[7] = false;
        }
    }

    let firstRow = false;
    for (let j = 0; j < 8; ++j) {
        if (glyph[0][j]) {
            firstRow = true;
            break;
        }
    }

    let lastRow = false;
    for (let j = 0; j < 8; ++j) {
        if (glyph[7][j]) {
            lastRow = true;
            break;
        }
    }

    if (firstRow && lastRow) {
        return undefined;
    }

    if (!firstRow && lastRow) {
        const row0 = glyph[0];
        for (let i = 0; i < 7; ++i) {
            glyph[i] = glyph[i + 1];
        }
        glyph[7] = row0;
    }

    return glyph;
}

function printGlyph(glyph: boolean[][]) {
    for (let i = 0; i < 8; ++i) {
        let s = '';
        for (let j = 0; j < 8; ++j) {
            s += glyph[i][j] ? 'X' : '.';
        }
        console.log(s);
    }
    console.log();
}

async function processFontFile(file: string) {
    const { data, info } = await sharp(`${FONTS_DIR}/${file}`).raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const inc = (width % 10 === 0) ? 10 : (width % 9 === 0) ? 9 : 8;
    for (let y = 0; y < height; y += inc) {
        for (let x = 0; x < width; x += inc) {
            const glyph = readGlyph(data, width, x, y);
            if (!glyph) {
                continue;
            }
            const key = JSON.stringify(glyph);
            if (glyphsSet.has(key)) {
                continue;
            }
            glyphsSet.add(key);
            glyphs.push(glyph);
            printGlyph(glyph);
        }
    }
}

export async function extractGlyphs() {
    for(const file of await fsPromises.readdir(FONTS_DIR)) {
        await processFontFile(file);
    }
    console.log(glyphs.length);
}