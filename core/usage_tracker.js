// usage_tracker.js - 每日免费用量追踪
// 使用 localStorage，每日 5 次免费，跨日自动重置
(function() {
    'use strict';

    const STORAGE_KEY = 'erl_daily_usage';
    const FREE_LIMIT = 200;

    /**
     * 获取今日日期字符串 YYYY-MM-DD
     */
    function getToday() {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * 读取用量数据
     */
    function getUsage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { date: getToday(), count: 0 };
            const data = JSON.parse(raw);
            // 跨日重置
            if (data.date !== getToday()) {
                return { date: getToday(), count: 0 };
            }
            return data;
        } catch (e) {
            return { date: getToday(), count: 0 };
        }
    }

    /**
     * 保存用量数据
     */
    function saveUsage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage 满了，忽略
        }
    }

    /**
     * 检查是否还有免费次数
     * @returns {boolean}
     */
    function hasQuota() {
        const usage = getUsage();
        return usage.count < FREE_LIMIT;
    }

    /**
     * 获取剩余次数
     * @returns {number}
     */
    function remaining() {
        const usage = getUsage();
        return Math.max(0, FREE_LIMIT - usage.count);
    }

    /**
     * 获取每日上限
     * @returns {number}
     */
    function limit() {
        return FREE_LIMIT;
    }

    /**
     * 消耗一次用量
     * @returns {{ ok: boolean, remaining: number, limit: number }}
     */
    function consume() {
        const usage = getUsage();
        if (usage.count >= FREE_LIMIT) {
            return { ok: false, remaining: 0, limit: FREE_LIMIT };
        }
        usage.count++;
        saveUsage(usage);
        return { ok: true, remaining: FREE_LIMIT - usage.count, limit: FREE_LIMIT };
    }

    /**
     * 获取用量摘要（用于 UI 显示）
     * @returns {{ used: number, remaining: number, limit: number }}
     */
    function summary() {
        const usage = getUsage();
        return {
            used: usage.count,
            remaining: Math.max(0, FREE_LIMIT - usage.count),
            limit: FREE_LIMIT
        };
    }

    window.UsageTracker = {
        hasQuota,
        remaining,
        limit,
        consume,
        summary
    };
})();