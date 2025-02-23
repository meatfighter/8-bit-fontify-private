import { promises as fsPromises } from 'fs';
import sharp from 'sharp';

const FONTS_DIR = "C:/js-projects/8-bit-fontify-private/fonts";
const GLYPHS_DIR = "C:/js-projects/8-bit-fontify-private/glyphs";

const GLYPH_SHADES_0 = 17;
const GLYPH_SHADES_1 = 13;
const GLYPH_SHADES_2 = 13;
const GLYPH_SHADES_3 = 10;

const GLYPHS_PER_ROW = 32;

type Glyph = boolean[][];
type GlyphList = Glyph[];
type NumberList = number[];

class DistinctGlyphs {
    constructor(public s: NumberList, public indicies: NumberList) {
    }
}

const glyphs: GlyphList = [];
const glyphsSet = new Set<string>();
const distinctGlyphs: DistinctGlyphs[] = [];

const glyphShades: NumberList[][][][] = new Array<NumberList[][][]>(GLYPH_SHADES_0);
const closestGlyphs: number[][][][] = new Array<number[][][]>(GLYPH_SHADES_0);

function readPixel(data: Buffer, width: number, x: number, y: number): boolean {
    return data[3 * (width * y + x)] > 0x7F;
}

function writePixel(data: Uint8Array, width: number, x: number, y: number, value: boolean) {
    data[width * y + x] = value ? 0xFF : 0x00;
}

function writeGlyph(data: Uint8Array, width: number, x: number, y: number, glyph: Glyph) {
    for (let i = 0; i < 8; ++i) {
        for (let j = 0; j < 8; ++j) {
            writePixel(data, width, x + j, y + i, glyph[i][j]);
        }
    }
}

function readGlyph(data: Buffer, width: number, x: number, y: number): Glyph | undefined {
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

function printGlyph(glyph: Glyph) {
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
            // printGlyph(glyph);
        }
    }
}

function computeShade(glyph: Glyph, x: number, y: number): number {
    let shade = 0;
    for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
            if (glyph[y + i][x + j]) {
                ++shade;
            }
        }
    }
    return shade;
}

function partitionGlyphs() {
    for (let s0 = 0; s0 < GLYPH_SHADES_0; ++s0) {
        glyphShades[s0] = new Array<NumberList[][]>(GLYPH_SHADES_1);
        for (let s1 = 0; s1 < GLYPH_SHADES_1; ++s1) {
            glyphShades[s0][s1] = new Array<NumberList[]>(GLYPH_SHADES_2);
            for (let s2 = 0; s2 < GLYPH_SHADES_2; ++s2) {
                glyphShades[s0][s1][s2] = new Array<NumberList>(GLYPH_SHADES_3);
            }
        }
    }

    for (let i = 0; i < glyphs.length; ++i) {
        const glyph = glyphs[i];
        const s0 = computeShade(glyph, 0, 0);
        const s1 = computeShade(glyph, 4, 0);
        const s2 = computeShade(glyph, 0, 4);
        const s3 = computeShade(glyph, 4, 4);
        if (!glyphShades[s0][s1][s2][s3]) {
            glyphShades[s0][s1][s2][s3] = [];
            distinctGlyphs.push(new DistinctGlyphs([ s0, s1, s2, s3 ], glyphShades[s0][s1][s2][s3]));
        }
        glyphShades[s0][s1][s2][s3].push(i);
    }

    console.log(`partitioned ${distinctGlyphs.length} distinct glyphs`);
}

function findClosest() {
    for (let s0 = 0; s0 < GLYPH_SHADES_0; ++s0) {
        closestGlyphs[s0] = new Array<number[][]>(GLYPH_SHADES_1);
        for (let s1 = 0; s1 < GLYPH_SHADES_1; ++s1) {
            closestGlyphs[s0][s1] = new Array<number[]>(GLYPH_SHADES_2);
            for (let s2 = 0; s2 < GLYPH_SHADES_2; ++s2) {
                closestGlyphs[s0][s1][s2] = new Array<number>(GLYPH_SHADES_3);
            }
        }
    }

    for (let s0 = 0; s0 < GLYPH_SHADES_0; ++s0) {
        for (let s1 = 0; s1 < GLYPH_SHADES_1; ++s1) {
            for (let s2 = 0; s2 < GLYPH_SHADES_2; ++s2) {
                for (let s3 = 0; s3 < GLYPH_SHADES_3; ++s3) {
                    let minD2 = Number.MAX_VALUE;
                    let minI = Number.MAX_VALUE;
                    for (let i = 0; i < distinctGlyphs.length; ++i) {
                        const dg = distinctGlyphs[i];
                        const ds0 = s0 - dg.s[0];
                        const ds1 = s1 - dg.s[1];
                        const ds2 = s2 - dg.s[2];
                        const ds3 = s3 - dg.s[3];
                        const d2 = ds0 * ds0 + ds1 * ds1 + ds2 * ds2 + ds3 * ds3;
                        if (d2 < minD2) {
                            minD2 = d2;
                            minI = i;
                        }                      
                    }
                    closestGlyphs[s0][s1][s2][s3] = minI;                    
                }
            }
        }
    }
}

async function saveImage() {
    const imageWidth = 8 * GLYPHS_PER_ROW;
    const cols = Math.ceil(glyphs.length / GLYPHS_PER_ROW);
    const imageHeight = 8 * cols;
    const data = new Uint8Array(imageWidth * imageHeight);
    data.fill(0);
    outer: for (let y = 0, i = 0; y < cols; ++y) {
        for (let x = 0; x < GLYPHS_PER_ROW; ++x, ++i) {
            if (i >= glyphs.length) {
                break outer;
            }
            const glyph = glyphs[i];            
            writeGlyph(data, imageWidth, 8 * x, 8 * y , glyph);
        }
    }
    await sharp(data, {
        raw: {
            width: imageWidth,
            height: imageHeight,
            channels: 1,
        },
    }).png().toFile(`${GLYPHS_DIR}/glyphs.png`);
}

async function saveResults() {
    await saveImage();

    // TODO SAVE TABLE
}

export async function processGlyphs() {
    console.log('started');
    for(const file of await fsPromises.readdir(FONTS_DIR)) {
        await processFontFile(file);
    }
    glyphsSet.clear();
    console.log(`read ${glyphs.length} glyphs`);

    partitionGlyphs();
    findClosest();
    await saveResults();
}