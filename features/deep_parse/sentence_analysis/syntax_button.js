// syntax_button.js - 处理句子卡片上语法结构按钮的点击事件
// 按三套分类体系（句子结构/句子功能/基本句式）分析并展示结构化结果面板

(function() {
    ModuleRegistry.register('SyntaxButton', ['Security', 'ErrorHandler', 'Performance', 'BaseAnalysisButton', 'GlobalManager'], function(Security, ErrorHandler, Performance, BaseAnalysisButton, GlobalManager) {
        
        // 从句类别的强调色
        const CLAUSE_COLORS = {
            '定语从句': '#5a7bd8',
            '状语从句': '#4f9d7f',
            '主语从句': '#b08ac8',
            '宾语从句': '#b08ac8',
            '表语从句': '#b08ac8',
            '同位语从句': '#b08ac8'
        };

        // 七类句子成分的强调色
        const CONSTITUENT_COLORS = {
            '主语': '#506080',
            '谓语': '#c75b7e',
            '宾语': '#4f9d7f',
            '表语': '#b08ac8',
            '定语': '#d98a3c',
            '状语': '#3fa7a0',
            '补语': '#b0704a'
        };

        class SyntaxButton extends BaseAnalysisButton.BaseAnalysisButton {
            constructor(security, errorHandler, performance, globalManager) {
                super({
                    security,
                    errorHandler,
                    performance,
                    cacheType: 'syntax',
                    typeName: '语法结构'
                });
                this.globalManager = globalManager;

                // 点击任意非徽章位置，关闭所有已展开的成分气泡（只绑定一次）
                document.addEventListener('click', (e) => {
                    if (!(e.target instanceof Element) || e.target.closest('.constituent-badge')) return; // 徽章自身处理，避免双重触发
                    document.querySelectorAll('.constituent-tip').forEach(el => el.remove());
                    document.querySelectorAll('.constituent-badge.constituent-badge-open').forEach(el => {
                        el.classList.remove('constituent-badge-open');
                    });
                });
            }

            async callApi(sentence) {
                const apiRequest = this.globalManager.getGlobalObject('APIRequest');
                return await apiRequest.requestSyntax(sentence);
            }

            isEmptyResult(result) {
                if (!result || typeof result !== 'object') return true;
                return !result.structure && !result.function && !result.pattern;
            }

            // 旧版缓存（无 constituents 字段）视为未缓存，强制重新请求以获取句子成分
            checkCache(idx) {
                const cached = super.checkCache(idx);
                if (cached && typeof cached === 'object' && !Array.isArray(cached.constituents)) {
                    return null;
                }
                return cached;
            }

            // 从分析结果中解析出三套分类 + 从句 + 成分 + 综合描述（兼容字符串/对象/旧缓存）
            parseResult(data) {
                let structure = '';
                let functionName = '';
                let pattern = '';
                let syntax = '暂无语法结构';
                let clauses = [];
                let constituents = [];
                if (typeof data === 'string') {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.syntax) {
                            structure = parsed.structure || parsed.type || '';
                            functionName = parsed.function || parsed.functionName || '';
                            pattern = parsed.pattern || '';
                            syntax = parsed.syntax;
                            clauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];
                            constituents = Array.isArray(parsed.constituents) ? parsed.constituents : [];
                            return { structure, function: functionName, pattern, syntax, clauses, constituents };
                        }
                    } catch (e) { /* 非JSON字符串，按纯文本处理 */ }
                    syntax = data;
                } else if (data && typeof data === 'object') {
                    structure = data.structure || data.type || '';
                    functionName = data.function || data.functionName || '';
                    pattern = data.pattern || '';
                    syntax = data.syntax || '暂无语法结构';
                    clauses = Array.isArray(data.clauses) ? data.clauses : [];
                    constituents = Array.isArray(data.constituents) ? data.constituents : [];
                }
                return { structure, function: functionName, pattern, syntax, clauses, constituents };
            }

            // 在句子右上角挂旋转45°的结构类型标签
            applyTypeBadge(card, type) {
                const sentenceText = card.querySelector('.sentence-text');
                if (!sentenceText) return;

                // 清理旧标签
                const oldBadge = sentenceText.querySelector('.sentence-type-badge');
                if (oldBadge) oldBadge.remove();
                sentenceText.classList.remove('has-type-badge');

                if (!type) return;

                const badge = document.createElement('span');
                badge.className = 'sentence-type-badge';
                badge.textContent = type;

                // 按类型给不同的强调色
                const colorMap = {
                    '简单句': 'var(--study-primary)',
                    '并列句': '#4f9d7f',
                    '复合句': '#b08ac8',
                    '并列复合句': '#e07b5a'
                };
                badge.style.setProperty('--type-color', colorMap[type] || 'var(--study-primary)');

                sentenceText.appendChild(badge);
                sentenceText.classList.add('has-type-badge');
            }

            // 生成一个分类标签（label 小字 + value 大字）
            makeBadge(label, value) {
                const badge = document.createElement('span');
                badge.className = 'syntax-badge';
                const lab = document.createElement('span');
                lab.className = 'syntax-badge-label';
                lab.textContent = label;
                const val = document.createElement('span');
                val.className = 'syntax-badge-value';
                val.textContent = value;
                badge.appendChild(lab);
                badge.appendChild(val);
                return badge;
            }

            // 生成一个从句条目
            makeClauseItem(clause) {
                const item = document.createElement('div');
                item.className = 'syntax-clause';

                const category = String(clause.category || '').trim();
                const subtype = String(clause.subtype || '').trim();
                const trigger = String(clause.trigger || '').trim();
                const text = String(clause.text || '').trim();

                const color = CLAUSE_COLORS[category] || 'var(--study-primary)';

                // 类别标签
                const head = document.createElement('div');
                head.className = 'syntax-clause-head';
                const catTag = document.createElement('span');
                catTag.className = 'syntax-clause-cat';
                catTag.textContent = category || '从句';
                catTag.style.setProperty('--clause-color', color);
                head.appendChild(catTag);

                // 引导词
                if (trigger) {
                    const trigTag = document.createElement('span');
                    trigTag.className = 'syntax-clause-trigger';
                    trigTag.textContent = '引导词 ' + trigger;
                    head.appendChild(trigTag);
                }
                item.appendChild(head);

                // 从句文本
                if (text) {
                    const textDiv = document.createElement('div');
                    textDiv.className = 'syntax-clause-text';
                    textDiv.textContent = text;
                    item.appendChild(textDiv);
                }

                // 细分逻辑关系
                if (subtype) {
                    const metaDiv = document.createElement('div');
                    metaDiv.className = 'syntax-clause-meta';
                    metaDiv.textContent = '细分：' + subtype;
                    item.appendChild(metaDiv);
                }

                return item;
            }

            // 在原句上标注句子成分：成分首词前挂彩色小徽章（如"主语"），点击徽章展开详细分类tip
            applyConstituentAnnotations(card, constituents) {
                const sentenceText = card.querySelector('.sentence-text');
                if (!sentenceText) return;

                // 清理旧徽章和tip
                sentenceText.querySelectorAll('.constituent-badge, .constituent-tip').forEach(el => el.remove());

                if (!Array.isArray(constituents) || constituents.length === 0) return;

                const wordSpans = Array.from(sentenceText.querySelectorAll('.word-span'));
                if (wordSpans.length === 0) return;

                const norm = s => String(s).replace(/[^a-zA-Z0-9']/g, '').toLowerCase();

                // 定位成分文本对应的单词区间（优先连续匹配，回退首词匹配）
                function locateTokens(tokens) {
                    if (tokens.length === 0) return null;
                    for (let i = 0; i <= wordSpans.length - tokens.length; i++) {
                        let ok = true;
                        for (let j = 0; j < tokens.length; j++) {
                            if (norm(wordSpans[i + j].dataset.word || '') !== tokens[j]) {
                                ok = false;
                                break;
                            }
                        }
                        if (ok) return [i, i + tokens.length - 1];
                    }
                    for (let i = 0; i < wordSpans.length; i++) {
                        if (norm(wordSpans[i].dataset.word || '') === tokens[0]) {
                            return [i, i];
                        }
                    }
                    return null;
                }

                // 收集待插入的徽章，按位置倒序插入，避免索引失效
                const insertions = [];
                constituents.forEach((constituent) => {
                    const name = String(constituent.name || '').trim();
                    const type = String(constituent.type || '').trim();
                    const text = String(constituent.text || '').trim();
                    const note = String(constituent.note || '').trim();
                    if (!name) return;

                    const tokens = text.split(/\s+/).map(norm).filter(Boolean);
                    if (tokens.length === 0) return;

                    const range = locateTokens(tokens);
                    if (!range) return;
                    insertions.push({ index: range[0], name, type, text, note });
                });

                insertions.sort((a, b) => b.index - a.index);
                insertions.forEach(({ index, name, type, text, note }) => {
                    const badge = document.createElement('span');
                    badge.className = 'constituent-badge';
                    // 徽章只显示单字（主/谓/宾/表/定/状/补），详细分类在点击后的tip里
                    const SHORT_NAME = { '主语': '主', '谓语': '谓', '宾语': '宾', '表语': '表', '定语': '定', '状语': '状', '补语': '补' };
                    badge.textContent = SHORT_NAME[name] || name;
                    badge.style.setProperty('--constituent-color', CONSTITUENT_COLORS[name] || 'var(--study-primary)');
                    badge.dataset.type = type;
                    badge.dataset.text = text;
                    badge.dataset.note = note;

                    badge.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.toggleConstituentTip(badge, sentenceText);
                    });

                    wordSpans[index].insertAdjacentElement('beforebegin', badge);
                });
            }

            // 点击成分徽章：展开/关闭详细分类tip
            toggleConstituentTip(badge, sentenceText) {
                // 先关闭所有已打开的tip
                sentenceText.querySelectorAll('.constituent-tip').forEach(el => el.remove());

                // 若该徽章原本已展开（其紧邻的tip被移除后再次点击），直接返回即完成关闭
                if (badge.classList.contains('constituent-badge-open')) {
                    badge.classList.remove('constituent-badge-open');
                    return;
                }

                badge.classList.add('constituent-badge-open');

                const tip = document.createElement('span');
                tip.className = 'constituent-tip';

                const type = badge.dataset.type;
                const text = badge.dataset.text;
                const note = badge.dataset.note;

                let html = '<strong>' + this.security.escapeHtml(type || badge.textContent) + '</strong>';
                if (text) html += '<div class="constituent-tip-text">' + this.security.escapeHtml(text) + '</div>';
                if (note) html += '<div class="constituent-tip-note">' + this.security.escapeHtml(note) + '</div>';
                tip.innerHTML = html;

                // 定位于徽章上方（绝对定位于 sentence-text 内）
                const badgeRect = badge.getBoundingClientRect();
                const parentRect = sentenceText.getBoundingClientRect();
                const left = badgeRect.left - parentRect.left + badgeRect.width / 2;
                const top = badgeRect.top - parentRect.top;
                tip.style.left = left + 'px';
                tip.style.top = (top - 8) + 'px';

                sentenceText.appendChild(tip);
            }

            displayInPanel(panel, data) {
                if (!panel) return;

                const { structure, function: fn, pattern, syntax, clauses, constituents } = this.parseResult(data);

                try {
                    panel.innerHTML = '';
                    const title = document.createElement('strong');
                    title.textContent = '语法结构';
                    panel.appendChild(title);

                    // 三套分类标签（结构/功能/句式）
                    const badgeRow = document.createElement('div');
                    badgeRow.className = 'syntax-badges';
                    if (structure) badgeRow.appendChild(this.makeBadge('结构', structure));
                    if (fn) badgeRow.appendChild(this.makeBadge('功能', fn));
                    if (pattern) badgeRow.appendChild(this.makeBadge('句式', pattern));
                    if (badgeRow.childElementCount > 0) {
                        panel.appendChild(badgeRow);
                    }

                    // 从句分析（结构化列表）
                    if (Array.isArray(clauses) && clauses.length > 0) {
                        const secTitle = document.createElement('div');
                        secTitle.className = 'syntax-section-title';
                        secTitle.textContent = '从句分析';
                        panel.appendChild(secTitle);

                        clauses.forEach((clause) => {
                            panel.appendChild(this.makeClauseItem(clause));
                        });
                    }

                    // 句子成分已在原句上用徽章标注（见 applyConstituentAnnotations），面板不再展示长列表

                    // 综合判定描述（textContent 赋值天然防注入，无需二次转义）
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'syntax-description';
                    contentDiv.textContent = syntax;
                    panel.appendChild(contentDiv);

                    // 句子右上角挂结构类型标签；清理旧的句内标注；标注句子成分
                    const card = panel.closest('.sentence-card');
                    if (card) {
                        this.applyTypeBadge(card, structure);
                        this.clearClauseAnnotations(card);
                        this.applyConstituentAnnotations(card, constituents);
                    }

                    panel.classList.add('show');
                } catch (e) {
                    console.error('显示语法结构数据失败:', e);
                    panel.innerHTML = '<strong>语法结构</strong><div>数据格式错误</div>';
                    panel.classList.add('show');
                }
            }

            // 清理旧版句内标注（从句下划线/tip气泡/成分徽章），避免遗留样式
            clearClauseAnnotations(card) {
                const sentenceText = card.querySelector('.sentence-text');
                if (!sentenceText) return;
                sentenceText.querySelectorAll('.clause-attributive, .clause-adverbial').forEach(span => {
                    span.classList.remove('clause-attributive', 'clause-adverbial');
                });
                sentenceText.querySelectorAll('.clause-tip, .constituent-badge, .constituent-tip').forEach(el => el.remove());
            }
        }
        
        const syntaxButton = new SyntaxButton(Security, ErrorHandler, Performance, GlobalManager);
        
        window.SyntaxButton = {
            loadAndDisplay: syntaxButton.loadAndDisplay.bind(syntaxButton)
        };
        
        window.onLoadSyntax = window.SyntaxButton.loadAndDisplay;
    });
})();
