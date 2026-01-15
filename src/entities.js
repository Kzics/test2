export class Flag {
    constructor(countryCode, x, y) {
        this.countryCode = countryCode;
        this.emoji = this.getFlagEmoji(countryCode);
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.velX = (Math.random() - 0.5) * 5; // Initial random burst
        this.velY = (Math.random() - 0.5) * 5;
        this.finished = false;
        this.finishTime = 0;
    }

    getFlagEmoji(countryCode) {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    }
}

export const COUNTRIES = [
    'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'JP', 'KR', 'CN', 'BR',
    'CA', 'AU', 'IN', 'RU', 'ZA', 'MX', 'AR', 'EG', 'NG', 'SE'
];
