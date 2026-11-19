import { apiClient } from '../src/api/client';
import { compareSpots, createAlert, deleteAlert, listAlerts, updateAlert } from '../src/api/endpoints';

jest.mock('../src/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = apiClient as unknown as Record<'get' | 'post' | 'patch' | 'delete', jest.Mock>;

const alertJson = (id: number) => ({
  id, channel: 'telegram', chat_id: '1', email: null, spot_ids: ['leca'],
  min_score: 6, enabled: true, quiet_start_hour: 22, quiet_end_hour: 6,
});
const spot = { id: 'leca', name: 'Leça', lat: 41.2, lon: -8.7, facing: 270, description: '' };

beforeEach(() => jest.resetAllMocks());

describe('compareSpots', () => {
  test('sends comma-joined spots and optional time', async () => {
    api.get.mockResolvedValue({ data: { time: 't', spots: [] } });
    await compareSpots(['leca', 'espinho'], '2026-11-18T09:00:00.000Z');
    expect(api.get).toHaveBeenCalledWith('/api/v1/forecast/compare', {
      params: { spots: 'leca,espinho', time: '2026-11-18T09:00:00.000Z' },
    });
  });

  test('omits time when not given', async () => {
    api.get.mockResolvedValue({ data: { time: 't', spots: [] } });
    await compareSpots(['leca']);
    expect(api.get.mock.calls[0][1]).toEqual({ params: { spots: 'leca' } });
  });

  test('parses snapshots with and without detail fields', async () => {
    api.get.mockResolvedValue({
      data: {
        time: 't',
        spots: [
          { spot, time: 't', total_score: 6, rating: 'good', summary: '' },
          { spot, time: 't', total_score: 5, rating: 'fair', summary: '', components: null, conditions: null },
        ],
      },
    });
    const res = await compareSpots(['leca']);
    expect(res.spots).toHaveLength(2);
  });

  test('rejects malformed responses', async () => {
    api.get.mockResolvedValue({ data: { time: 't', spots: [{ bogus: true }] } });
    await expect(compareSpots(['leca'])).rejects.toThrow();
  });

  test('propagates HTTP errors', async () => {
    api.get.mockRejectedValue(new Error('404'));
    await expect(compareSpots(['nazare'])).rejects.toThrow('404');
  });
});

describe('listAlerts', () => {
  test('returns a single page', async () => {
    api.get.mockResolvedValue({ data: { items: [alertJson(1)], next_cursor: null } });
    expect(await listAlerts()).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/api/v1/alerts', { params: { limit: 100 } });
  });

  test('follows next_cursor across pages', async () => {
    api.get
      .mockResolvedValueOnce({ data: { items: [alertJson(1)], next_cursor: 1 } })
      .mockResolvedValueOnce({ data: { items: [alertJson(2)], next_cursor: null } });
    const all = await listAlerts();
    expect(all.map((a) => a.id)).toEqual([1, 2]);
    expect(api.get.mock.calls[1][1]).toEqual({ params: { limit: 100, cursor: 1 } });
  });

  test('stops after the page bound if the cursor never ends', async () => {
    api.get.mockResolvedValue({ data: { items: [alertJson(1)], next_cursor: 1 } });
    await listAlerts();
    expect(api.get).toHaveBeenCalledTimes(10);
  });

  test('handles empty list', async () => {
    api.get.mockResolvedValue({ data: { items: [], next_cursor: null } });
    expect(await listAlerts()).toEqual([]);
  });
});

describe('alert mutations', () => {
  test('createAlert posts and parses', async () => {
    api.post.mockResolvedValue({ data: alertJson(5) });
    const body = {
      channel: 'telegram' as const, chat_id: '1', spot_ids: ['leca'],
      min_score: 6, quiet_start_hour: 22, quiet_end_hour: 6,
    };
    expect((await createAlert(body)).id).toBe(5);
    expect(api.post).toHaveBeenCalledWith('/api/v1/alerts', body);
  });

  test('updateAlert patches by id', async () => {
    api.patch.mockResolvedValue({ data: { ...alertJson(3), enabled: false } });
    const res = await updateAlert(3, { enabled: false });
    expect(res.enabled).toBe(false);
    expect(api.patch).toHaveBeenCalledWith('/api/v1/alerts/3', { enabled: false });
  });

  test('deleteAlert calls delete by id', async () => {
    api.delete.mockResolvedValue({ data: { deleted: 3 } });
    await deleteAlert(3);
    expect(api.delete).toHaveBeenCalledWith('/api/v1/alerts/3');
  });

  test('createAlert surfaces server errors', async () => {
    api.post.mockRejectedValue(new Error('409'));
    await expect(
      createAlert({ channel: 'email', email: 'a@b.co', spot_ids: ['leca'], min_score: 6, quiet_start_hour: 0, quiet_end_hour: 0 }),
    ).rejects.toThrow('409');
  });
});
