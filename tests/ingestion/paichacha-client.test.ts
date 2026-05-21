import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaichachaClient } from '../../src/ingestion/paichacha-client.js';

describe('PaichachaClient', () => {
  let client: PaichachaClient;

  beforeEach(() => {
    client = new PaichachaClient('https://api.paichacha.test', 'test-api-key', {
      maxRetries: 3,
      baseDelayMs: 10, // Short delay for tests
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPugongyingData', () => {
    it('should return empty array for empty noteIds', async () => {
      const result = await client.fetchPugongyingData([]);
      expect(result).toEqual([]);
    });

    it('should fetch and transform pugongying data with normalizeAmount applied', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            brand_user_name: 'TestBrand',
            spu_name: 'TestProduct',
            kol_nick_name: 'TestKOL',
            kol_id: 'kol_001',
            kol_fan_num: 50000,
            note_type: 'image',
            note_link: 'https://xhs.com/note/001',
            imp_num: 10000,
            read_num: 5000,
            engage_num: 1200,
            like_num: 800,
            fav_num: 200,
            cmt_num: 100,
            share_num: 100,
            kol_price: 150000,           // 1500.00 元
            service_fee: 200,            // Already in yuan
            total_platform_price: 180000, // 1800.00 元
            heat_imp_num: 2000,
            heat_read_num: 1000,
            is_underwater: false,
            underwater_price: 0,
            components: [
              {
                component_type: '正文组件',
                impressions: 5000,
                clicks: 300,
                conversions: 50,
              },
            ],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.fetchPugongyingData(['note_001']);

      expect(result).toHaveLength(1);
      expect(result[0].noteId).toBe('note_001');
      expect(result[0].kolPrice).toBe(1500.00);           // normalizeAmount(150000)
      expect(result[0].totalPlatformPrice).toBe(1800.00); // normalizeAmount(180000)
      expect(result[0].serviceFee).toBe(200);             // Not converted
      expect(result[0].kolFanNum).toBe(50000);
      expect(result[0].noteType).toBe('image');
      expect(result[0].components).toHaveLength(1);
      expect(result[0].components![0].componentType).toBe('正文组件');
    });

    it('should reject malformed pugongying data (missing note_id)', async () => {
      const mockResponse = {
        data: [
          {
            // note_id is missing
            brand_user_name: 'TestBrand',
            kol_id: 'kol_001',
            kol_fan_num: 50000,
            note_type: 'image',
            note_link: 'https://xhs.com/note/001',
            imp_num: 10000,
            read_num: 5000,
            engage_num: 1200,
            like_num: 800,
            fav_num: 200,
            cmt_num: 100,
            share_num: 100,
            kol_price: 150000,
            service_fee: 200,
            total_platform_price: 180000,
            heat_imp_num: 2000,
            heat_read_num: 1000,
            is_underwater: false,
            underwater_price: 0,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.fetchPugongyingData(['note_001'])).rejects.toThrow(
        'Invalid pugongying note: missing or empty required field "note_id"'
      );
    });

    it('should reject pugongying data with invalid note_type', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            brand_user_name: 'TestBrand',
            spu_name: 'TestProduct',
            kol_nick_name: 'TestKOL',
            kol_id: 'kol_001',
            kol_fan_num: 50000,
            note_type: 'audio', // Invalid
            note_link: 'https://xhs.com/note/001',
            imp_num: 10000,
            read_num: 5000,
            engage_num: 1200,
            like_num: 800,
            fav_num: 200,
            cmt_num: 100,
            share_num: 100,
            kol_price: 150000,
            service_fee: 200,
            total_platform_price: 180000,
            heat_imp_num: 2000,
            heat_read_num: 1000,
            is_underwater: false,
            underwater_price: 0,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.fetchPugongyingData(['note_001'])).rejects.toThrow(
        'note_type must be "image" or "video"'
      );
    });
  });

  describe('fetchJuguangData', () => {
    it('should return empty array for empty noteIds', async () => {
      const result = await client.fetchJuguangData([]);
      expect(result).toEqual([]);
    });

    it('should fetch and transform juguang data with normalizeAmount applied to fee', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            fee: 250000,                  // 2500.00 元
            impression: 80000,
            click: 4000,
            interaction: 1500,
            i_user_num: 300,
            ti_user_num: 50,
            i_user_price: 8.5,
            ti_user_price: 50.0,
            search_cmt_click: 200,
            search_cmt_after_read: 150,
            search_cmt_after_read_avg: 3.5,
            search_cmt_click_cvr: 0.025,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.fetchJuguangData(['note_001']);

      expect(result).toHaveLength(1);
      expect(result[0].fee).toBe(2500.00);  // normalizeAmount(250000)
      expect(result[0].noteId).toBe('note_001');
      expect(result[0].impression).toBe(80000);
      expect(result[0].click).toBe(4000);
      expect(result[0].iUserNum).toBe(300);
    });

    it('should reject juguang data with non-integer fee', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            fee: 250.5,                   // Not an integer
            impression: 80000,
            click: 4000,
            interaction: 1500,
            i_user_num: 300,
            ti_user_num: 50,
            i_user_price: 8.5,
            ti_user_price: 50.0,
            search_cmt_click: 200,
            search_cmt_after_read: 150,
            search_cmt_after_read_avg: 3.5,
            search_cmt_click_cvr: 0.025,
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.fetchJuguangData(['note_001'])).rejects.toThrow(
        'fee must be a non-negative integer'
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on HTTP failure and succeed on subsequent attempt', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            fee: 100000,
            impression: 50000,
            click: 2000,
            interaction: 800,
            i_user_num: 100,
            ti_user_num: 20,
            i_user_price: 5.0,
            ti_user_price: 25.0,
            search_cmt_click: 100,
            search_cmt_after_read: 80,
            search_cmt_after_read_avg: 2.0,
            search_cmt_click_cvr: 0.02,
          },
        ],
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch');

      // First attempt fails
      fetchMock.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );
      // Second attempt succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.fetchJuguangData(['note_001']);

      expect(result).toHaveLength(1);
      expect(result[0].fee).toBe(1000.00);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw after all retries are exhausted', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');

      // All 4 attempts (1 initial + 3 retries) fail
      fetchMock.mockResolvedValue(
        new Response('Service Unavailable', { status: 503 })
      );

      await expect(client.fetchJuguangData(['note_001'])).rejects.toThrow(
        /failed after 4 attempts/
      );

      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('should retry on network errors', async () => {
      const mockResponse = {
        data: [
          {
            note_id: 'note_001',
            fee: 50000,
            impression: 30000,
            click: 1500,
            interaction: 600,
            i_user_num: 80,
            ti_user_num: 15,
            i_user_price: 6.0,
            ti_user_price: 30.0,
            search_cmt_click: 50,
            search_cmt_after_read: 40,
            search_cmt_after_read_avg: 1.5,
            search_cmt_click_cvr: 0.015,
          },
        ],
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch');

      // First two attempts throw network error
      fetchMock.mockRejectedValueOnce(new Error('Network timeout'));
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      // Third attempt succeeds
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.fetchJuguangData(['note_001']);

      expect(result).toHaveLength(1);
      expect(result[0].fee).toBe(500.00);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('response validation', () => {
    it('should reject non-array response', async () => {
      const mockResponse = { data: { message: 'not an array' } };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.fetchPugongyingData(['note_001'])).rejects.toThrow(
        'expected array of records'
      );
    });

    it('should reject null response body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('null', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.fetchPugongyingData(['note_001'])).rejects.toThrow(
        'invalid response'
      );
    });
  });

  describe('API request format', () => {
    it('should send correct headers and body', async () => {
      const mockResponse = { data: [] };

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await client.fetchPugongyingData(['note_001', 'note_002']);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.paichacha.test/api/pugongying/notes',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
          body: JSON.stringify({ note_ids: ['note_001', 'note_002'] }),
        })
      );
    });

    it('should strip trailing slashes from base URL', async () => {
      const clientWithSlash = new PaichachaClient(
        'https://api.paichacha.test/',
        'test-key',
        { baseDelayMs: 10 }
      );

      const mockResponse = { data: [] };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await clientWithSlash.fetchJuguangData(['note_001']);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.paichacha.test/api/juguang/notes',
        expect.anything()
      );
    });
  });
});
