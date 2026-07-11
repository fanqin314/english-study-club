/**
 * init-new-architecture.js - 新架构初始化脚本（暂时禁用重复按钮添加）
 *
 * 用途：提供新架构基础设施，供后续扩展使用
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    console.log('[NewArchitectureInit] 新架构框架已加载（暂不自动添加组件）');

    // 暴露到全局供调试
    window.NewArchitectureInit = {
        // 可以手动调用初始化
        initComponents: function() {
            console.log('[NewArchitectureInit] 新架构组件框架就绪');
        }
    };
})();
