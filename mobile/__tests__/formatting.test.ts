import {
  scoreToRating,
  scoreToColor,
  degreeToCompass,
  formatWaveHeight,
  formatWindSpeed,
  formatPeriod,
  isNortadaWarning,
  formatScore,
} from '../src/utils/formatting';
import { colors } from '../src/theme/colors';

describe('scoreToRating', () => {
  test('returns flat for very low scores', () => {
    expect(scoreToRating(0)).toBe('flat');
    expect(scoreToRating(1.5)).toBe('flat');
  });

  test('returns poor for low scores', () => {
    expect(scoreToRating(2.5)).toBe('poor');
    expect(scoreToRating(3.9)).toBe('poor');
  });

  test('returns fair for mid-low scores', () => {
    expect(scoreToRating(4.0)).toBe('fair');
    expect(scoreToRating(5.4)).toBe('fair');
  });

  test('returns good for mid scores', () => {
    expect(scoreToRating(5.5)).toBe('good');
    expect(scoreToRating(6.9)).toBe('good');
  });

  test('returns great for high scores', () => {
    expect(scoreToRating(7.0)).toBe('great');
    expect(scoreToRating(8.4)).toBe('great');
  });

  test('returns epic for top scores', () => {
    expect(scoreToRating(8.5)).toBe('epic');
    expect(scoreToRating(10)).toBe('epic');
  });
});

describe('scoreToColor', () => {
  test('returns epic color for 8.5+', () => {
    expect(scoreToColor(9)).toBe(colors.scoreEpic);
  });

  test('returns flat color for <2', () => {
    expect(scoreToColor(1)).toBe(colors.scoreFlat);
  });

  test('returns good color for 5.5-6.9', () => {
    expect(scoreToColor(6.0)).toBe(colors.scoreGood);
  });
});

describe('degreeToCompass', () => {
  test('returns N for 0 degrees', () => {
    expect(degreeToCompass(0)).toBe('N');
  });

  test('returns E for 90 degrees', () => {
    expect(degreeToCompass(90)).toBe('E');
  });

  test('returns S for 180 degrees', () => {
    expect(degreeToCompass(180)).toBe('S');
  });

  test('returns W for 270 degrees', () => {
    expect(degreeToCompass(270)).toBe('W');
  });

  test('returns NW for 315 degrees', () => {
    expect(degreeToCompass(315)).toBe('NW');
  });

  test('returns -- for null', () => {
    expect(degreeToCompass(null)).toBe('--');
    expect(degreeToCompass(undefined)).toBe('--');
  });

  test('handles 360 as N', () => {
    expect(degreeToCompass(360)).toBe('N');
  });

  test('handles negative degrees', () => {
    expect(degreeToCompass(-90)).toBe('W');
  });
});

describe('formatWaveHeight', () => {
  test('formats with 1 decimal and m suffix', () => {
    expect(formatWaveHeight(1.5)).toBe('1.5m');
    expect(formatWaveHeight(0.8)).toBe('0.8m');
  });

  test('returns -- for null', () => {
    expect(formatWaveHeight(null)).toBe('--');
    expect(formatWaveHeight(undefined)).toBe('--');
  });
});

describe('formatWindSpeed', () => {
  test('rounds and adds km/h', () => {
    expect(formatWindSpeed(15.7)).toBe('16 km/h');
    expect(formatWindSpeed(8.2)).toBe('8 km/h');
  });

  test('returns -- for null', () => {
    expect(formatWindSpeed(null)).toBe('--');
  });
});

describe('formatPeriod', () => {
  test('rounds and adds s suffix', () => {
    expect(formatPeriod(12.3)).toBe('12s');
    expect(formatPeriod(8)).toBe('8s');
  });

  test('returns -- for null', () => {
    expect(formatPeriod(null)).toBe('--');
  });
});

describe('isNortadaWarning', () => {
  test('returns true when wind_trend below threshold', () => {
    expect(isNortadaWarning(0.1)).toBe(true);
    expect(isNortadaWarning(0.29)).toBe(true);
  });

  test('returns false when wind_trend at or above threshold', () => {
    expect(isNortadaWarning(0.3)).toBe(false);
    expect(isNortadaWarning(0.8)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isNortadaWarning(null)).toBe(false);
    expect(isNortadaWarning(undefined)).toBe(false);
  });
});

describe('formatScore', () => {
  test('formats to 1 decimal', () => {
    expect(formatScore(7.0)).toBe('7.0');
    expect(formatScore(5.0)).toBe('5.0');
    expect(formatScore(8.23)).toBe('8.2');
  });
});
