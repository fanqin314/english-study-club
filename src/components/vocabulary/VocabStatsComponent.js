/**
 * VocabStatsComponent - 词汇统计组件
 *
 * 用途：显示词汇数量统计，支持刷新
 * 注册名称：VocabStats
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    // 确保依赖已加载
    const BaseComponent = window.BaseComponent || (window.ModuleRegistry && window.ModuleRegistry.get('BaseComponent'));

    if (!BaseComponent) {
        console.error('[VocabStatsComponent] BaseComponent 未加载');
        return;
    }

    class VocabStatsComponent extends BaseComponent {
        /**
         * 初始化组件
         */
        onInit() {
            this.state = {
                notebookCount: 0,
                wordCount: 0
            };

            // 获取 VocabData
            this.vocabData = window.VocabData ||
                (window.GlobalManager && window.GlobalManager.getGlobalObject('VocabData'));

            console.log('[VocabStatsComponent] VocabData:', !!this.vocabData);
        }

        /**
         * 组件挂载后
         */
        onMount() {
            this.refreshStats();
            this.setupSubscription();
        }

        /**
         * 设置数据变化订阅
         */
        setupSubscription() {
            // 如果有 EventBus，订阅词汇数据变化
            if (window.EventBus) {
                this.unsubscribe = window.EventBus.subscribe('vocabDataChanged', () => {
                    this.refreshStats();
                });
            }
        }

        /**
         * 渲染组件
         */
        onRender() {
            this.renderTemplate(this.getTemplate());
        }

        /**
         * 生成模板
         */
        getTemplate() {
            const { notebookCount, wordCount } = this.state;

            return `
                <span class="stats-text">
                    <span>${notebookCount} 个生词本</span> | <span>${wordCount} 个单词</span>
                </span>
            `;
        }

        /**
         * 刷新统计数据
         */
        refreshStats() {
            if (!this.vocabData) {
                console.warn('[VocabStatsComponent] VocabData 不可用，使用默认值');
                this.update({ notebookCount: 0, wordCount: 0 });
                return;
            }

            try {
                // 获取数据（兼容 VocabData 两种可能的 API）
                const notebooks = typeof this.vocabData.getAllNotebooks === 'function'
                    ? this.vocabData.getAllNotebooks()
                    : [];

                const notebookCount = Array.isArray(notebooks)
                    ? notebooks.length
                    : Object.keys(notebooks).length;

                let wordCount = 0;

                // 计算单词总数
                if (Array.isArray(notebooks)) {
                    notebooks.forEach(nb => {
                        if (nb.words && Array.isArray(nb.words)) {
                            wordCount += nb.words.length;
                        }
                    });
                } else if (typeof notebooks === 'object') {
                    Object.values(notebooks).forEach(nb => {
                        if (nb.words && Array.isArray(nb.words)) {
                            wordCount += nb.words.length;
                        }
                    });
                }

                console.log('[VocabStatsComponent] 统计更新:', { notebookCount, wordCount });
                this.update({ notebookCount, wordCount });
            } catch (error) {
                console.error('[VocabStatsComponent] 刷新统计失败:', error);
            }
        }

        /**
         * 销毁组件
         */
        onDestroy() {
            if (this.unsubscribe) {
                this.unsubscribe();
            }
        }
    }

    // 注册组件
    if (window.componentRegistry) {
        window.componentRegistry.register(
            'VocabStats',
            VocabStatsComponent,
            '词汇统计组件，显示生词本和单词数量'
        );
    }

    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('VocabStatsComponent', ['BaseComponent'], function() {
            return VocabStatsComponent;
        });
    }

    window.VocabStatsComponent = VocabStatsComponent;

    console.log('[VocabStatsComponent] 组件已加载');
})();
