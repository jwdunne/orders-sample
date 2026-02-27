import { defineProject } from 'vitest/config';

export default defineProject({
    test: {
        environment: 'node',
        testTimeout: 10_000
    }
});
