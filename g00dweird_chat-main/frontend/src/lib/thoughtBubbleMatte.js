export function shouldClearThoughtBubblePixel(r, g, b, a = 255) {
    if (a < 8) return false;

    const matteRed = r > 180 && g < 92 && b < 92 && r > g * 2.25 && r > b * 2.25;
    const darkRed = r > 120 && g < 42 && b < 42 && r > g * 3 && r > b * 3;
    const guideYellow = r > 180 && g > 105 && b < 70 && r > b * 3 && g > b * 2;
    const guideOrange = r > 180 && g > 80 && b < 45 && r > b * 4 && g > b * 2;

    return matteRed || darkRed || guideYellow || guideOrange;
}

export function clearThoughtBubbleMatte(imageData) {
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        if (shouldClearThoughtBubblePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
            data[i + 3] = 0;
        }
    }
    return imageData;
}
