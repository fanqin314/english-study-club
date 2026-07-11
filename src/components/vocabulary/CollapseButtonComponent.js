/**
 * CollapseButtonComponent - 折叠按钮组件
 *
 * 用途：控制区域的折叠和展开
 * 注册名称：CollapseButton
 * 创建日期：2026-05-02
 */

(function() {
    'use strict';

    // 确保 BaseComponent 已加载
    const BaseComponent = window.BaseComponent || (window.ModuleRegistry && window.ModuleRegistry.get('BaseComponent'));

    if (!BaseComponent) {
        console.error('[CollapseButtonComponent] BaseComponent 未加载，组件无法初始化');
        return;
    }

    class CollapseButtonComponent extends BaseComponent {
        /**
         * 获取默认配置选项
         */
        getDefaultOptions() {
            return {
                targetSelectors: ['.create-notebook-section', '.notebook-tabs'],
                collapsedIcon: `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <polyline points="6 15 12 9 18 15"></polyline>
                    </svg>
                `,
                expandedIcon: `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                `,
                collapsedTitle: '展开生词本列表',
                expandedTitle: '折叠生词本列表'
            };
        }

        /**
         * 初始化组件
         */
        onInit() {
            this.state = {
                isCollapsed: false
            };

            // 查找目标元素
            this.targetElements = this.options.targetSelectors.map(selector =>
                typeof selector === 'string' ? document.querySelector(selector) : selector
            ).filter(el => el !== null);

            console.log('[CollapseButtonComponent] 目标元素数量:', this.targetElements.length);
        }

        /**
         * 组件挂载后
         */
        onMount() {
            this.bindEvents();
            this.updateButtonState();
        }

        /**
         * 渲染组件
         */
        onRender() {
            this.renderTemplate(this.getTemplate());
        }

        /**
         * 生成按钮模板
         */
        getTemplate() {
            const { isCollapsed } = this.state;
            const { collapsedIcon, expandedIcon, collapsedTitle, expandedTitle } = this.options;

            const icon = isCollapsed ? collapsedIcon : expandedIcon;
            const title = isCollapsed ? collapsedTitle : expandedTitle;

            return `
                <button class="collapse-btn" aria-label="${title}" title="${title}">
                    ${icon}
                </button>
            `;
        }

        /**
         * 绑定事件
         */
        bindEvents() {
            this.on('.collapse-btn', 'click', this.toggleCollapse);
        }

        /**
         * 切换折叠状态
         */
        toggleCollapse() {
            const newCollapsedState = !this.state.isCollapsed;

            console.log('[CollapseButtonComponent] 切换折叠状态:', newCollapsedState);

            // 更新目标元素显示
            this.targetElements.forEach(el => {
                el.style.display = newCollapsedState ? 'none' : '';
            });

            // 更新状态和UI
            this.update({ isCollapsed: newCollapsedState });

            // 更新全局状态（可选）
            if (window.globalState) {
                window.globalState.setState({ vocabExpanded: !newCollapsedState });
            }
        }

        /**
         * 更新按钮UI状态
         */
        updateButtonState() {
            const button = this.container?.querySelector('.collapse-btn');
            if (!button) return;

            const { isCollapsed } = this.state;
            const { collapsedIcon, expandedIcon, collapsedTitle, expandedTitle } = this.options;

            button.innerHTML = isCollapsed ? collapsedIcon : expandedIcon;
            button.setAttribute('aria-label', isCollapsed ? collapsedTitle : expandedTitle);
            button.setAttribute('title', isCollapsed ? collapsedTitle : expandedTitle);
        }

        /**
         * 状态更新时调用
         */
        onUpdate(oldState, newState) {
            if (oldState.isCollapsed !== newState.isCollapsed) {
                this.updateButtonState();
            }
        }
    }

    // 注册组件
    if (window.componentRegistry) {
        window.componentRegistry.register(
            'CollapseButton',
            CollapseButtonComponent,
            '折叠按钮组件，控制区域展开/折叠'
        );
    }

    if (window.ModuleRegistry) {
        window.ModuleRegistry.register('CollapseButtonComponent', ['BaseComponent'], function() {
            return CollapseButtonComponent;
        });
    }

    window.CollapseButtonComponent = CollapseButtonComponent;

    console.log('[CollapseButtonComponent] 组件已加载');
})();
