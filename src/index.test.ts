import { describe, expect, it, vi } from 'vitest';

import { main } from './index.js';

describe('main', () => {
  it('should log initialization message', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    main();

    expect(consoleSpy).toHaveBeenCalledWith('YG Node Starter initialized');
    consoleSpy.mockRestore();
  });
});
