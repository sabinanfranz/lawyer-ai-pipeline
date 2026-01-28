import { CHANNELS, CHANNEL_ORDER, isChannel } from './channel';

describe('channel SSOT', () => {
  it('CHANNELS has no duplicates', () => {
    const unique = new Set(CHANNELS);
    expect(unique.size).toBe(CHANNELS.length);
  });

  it('CHANNEL_ORDER is a permutation of CHANNELS with same length', () => {
    expect(CHANNEL_ORDER.length).toBe(CHANNELS.length);
    const orderSet = new Set(CHANNEL_ORDER);
    expect(orderSet.size).toBe(CHANNELS.length);
    CHANNELS.forEach((c) => expect(orderSet.has(c)).toBe(true));
  });

  it('isChannel guards correctly', () => {
    expect(isChannel('naver')).toBe(true);
    expect(isChannel('linkedin')).toBe(true);
    expect(isChannel('threads')).toBe(true);
    expect(isChannel('other')).toBe(false);
    expect(isChannel(123)).toBe(false);
  });
});
