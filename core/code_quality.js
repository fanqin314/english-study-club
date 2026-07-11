// code_quality.js - 代码质量检查工具

(function() {
    ModuleRegistry.register('CodeQuality', [], function() {
        /**
         * 代码质量检查工具
         * 提供代码质量检查和规范验证功能
         */
        const CodeQuality = {
            /**
             * 检查模块命名规范
             * @param {string} moduleName - 模块名称
             * @returns {Object} 检查结果 {valid: boolean, message: string}
             */
            checkModuleName: function(moduleName) {
                // 模块名称应该是驼峰命名，首字母大写
                const regex = /^[A-Z][a-zA-Z0-9]*$/;
                if (!regex.test(moduleName)) {
                    return {
                        valid: false,
                        message: `模块名称 ${moduleName} 不符合命名规范，应该是驼峰命名，首字母大写`
                    };
                }
                return {
                    valid: true,
                    message: `模块名称 ${moduleName} 符合命名规范`
                };
            },
            
            /**
             * 检查函数命名规范
             * @param {string} functionName - 函数名称
             * @returns {Object} 检查结果 {valid: boolean, message: string}
             */
            checkFunctionName: function(functionName) {
                // 函数名称应该是驼峰命名，首字母小写
                const regex = /^[a-z][a-zA-Z0-9]*$/;
                if (!regex.test(functionName)) {
                    return {
                        valid: false,
                        message: `函数名称 ${functionName} 不符合命名规范，应该是驼峰命名，首字母小写`
                    };
                }
                return {
                    valid: true,
                    message: `函数名称 ${functionName} 符合命名规范`
                };
            },
            
            /**
             * 检查变量命名规范
             * @param {string} variableName - 变量名称
             * @returns {Object} 检查结果 {valid: boolean, message: string}
             */
            checkVariableName: function(variableName) {
                // 变量名称应该是驼峰命名，首字母小写
                const regex = /^[a-z][a-zA-Z0-9]*$/;
                if (!regex.test(variableName)) {
                    return {
                        valid: false,
                        message: `变量名称 ${variableName} 不符合命名规范，应该是驼峰命名，首字母小写`
                    };
                }
                return {
                    valid: true,
                    message: `变量名称 ${variableName} 符合命名规范`
                };
            },
            
            /**
             * 检查常量命名规范
             * @param {string} constantName - 常量名称
             * @returns {Object} 检查结果 {valid: boolean, message: string}
             */
            checkConstantName: function(constantName) {
                // 常量名称应该是大写，单词之间用下划线分隔
                const regex = /^[A-Z][A-Z0-9_]*$/;
                if (!regex.test(constantName)) {
                    return {
                        valid: false,
                        message: `常量名称 ${constantName} 不符合命名规范，应该是大写，单词之间用下划线分隔`
                    };
                }
                return {
                    valid: true,
                    message: `常量名称 ${constantName} 符合命名规范`
                };
            },
            
            /**
             * 检查代码缩进
             * @param {string} code - 代码字符串
             * @returns {Object} 检查结果 {valid: boolean, message: string, issues: Array}
             */
            checkIndentation: function(code) {
                const lines = code.split('\n');
                const issues = [];
                let indentationLevel = 0;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line === '') continue;
                    
                    // 检查缩进级别
                    const leadingSpaces = lines[i].match(/^\s*/)[0].length;
                    const expectedIndentation = indentationLevel * 4; // 4个空格缩进
                    
                    if (leadingSpaces !== expectedIndentation) {
                        issues.push(`第 ${i + 1} 行: 缩进不正确，期望 ${expectedIndentation} 个空格，实际 ${leadingSpaces} 个空格`);
                    }
                    
                    // 更新缩进级别
                    if (line.endsWith('{')) {
                        indentationLevel++;
                    } else if (line.startsWith('}')) {
                        indentationLevel--;
                    }
                }
                
                if (issues.length > 0) {
                    return {
                        valid: false,
                        message: `代码缩进检查发现 ${issues.length} 个问题`,
                        issues: issues
                    };
                }
                
                return {
                    valid: true,
                    message: '代码缩进检查通过',
                    issues: []
                };
            },
            
            /**
             * 检查代码注释
             * @param {string} code - 代码字符串
             * @returns {Object} 检查结果 {valid: boolean, message: string, issues: Array}
             */
            checkComments: function(code) {
                const lines = code.split('\n');
                const issues = [];
                let functionCount = 0;
                let commentedFunctions = 0;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // 检查函数注释
                    if (line.startsWith('function ') || line.includes('function(') || line.includes('=>')) {
                        functionCount++;
                        // 检查前一行是否有注释
                        if (i > 0 && (lines[i - 1].trim().startsWith('//') || lines[i - 1].trim().startsWith('*'))) {
                            commentedFunctions++;
                        } else {
                            issues.push(`第 ${i + 1} 行: 函数缺少注释`);
                        }
                    }
                }
                
                if (functionCount > 0 && commentedFunctions < functionCount) {
                    return {
                        valid: false,
                        message: `代码注释检查发现 ${functionCount - commentedFunctions} 个函数缺少注释`,
                        issues: issues
                    };
                }
                
                return {
                    valid: true,
                    message: '代码注释检查通过',
                    issues: []
                };
            },
            
            /**
             * 检查代码长度
             * @param {string} code - 代码字符串
             * @returns {Object} 检查结果 {valid: boolean, message: string, issues: Array}
             */
            checkCodeLength: function(code) {
                const lines = code.split('\n');
                const issues = [];
                const maxLineLength = 80;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.length > maxLineLength) {
                        issues.push(`第 ${i + 1} 行: 代码长度超过 ${maxLineLength} 个字符`);
                    }
                }
                
                if (issues.length > 0) {
                    return {
                        valid: false,
                        message: `代码长度检查发现 ${issues.length} 行代码过长`,
                        issues: issues
                    };
                }
                
                return {
                    valid: true,
                    message: '代码长度检查通过',
                    issues: []
                };
            },
            
            /**
             * 检查代码质量
             * @param {string} code - 代码字符串
             * @param {string} fileName - 文件名
             * @returns {Object} 检查结果
             */
            checkCodeQuality: function(code, fileName) {
                const results = {
                    fileName: fileName,
                    indentation: this.checkIndentation(code),
                    comments: this.checkComments(code),
                    codeLength: this.checkCodeLength(code)
                };
                
                const allValid = results.indentation.valid && results.comments.valid && results.codeLength.valid;
                
                return {
                    ...results,
                    valid: allValid,
                    message: allValid ? '代码质量检查通过' : '代码质量检查发现问题'
                };
            },
            
            /**
             * 生成代码质量报告
             * @param {Array} files - 文件列表 {fileName: string, code: string}
             * @returns {Object} 质量报告
             */
            generateQualityReport: function(files) {
                const reports = files.map(file => this.checkCodeQuality(file.code, file.fileName));
                const validReports = reports.filter(report => report.valid);
                const invalidReports = reports.filter(report => !report.valid);
                
                return {
                    totalFiles: files.length,
                    validFiles: validReports.length,
                    invalidFiles: invalidReports.length,
                    reports: reports
                };
            },
            
            /**
             * 初始化方法
             */
            init: function() {
                console.log('CodeQuality 模块初始化完成');
            },
            
            /**
             * 获取模块名称
             * @returns {string} 模块名称
             */
            getName: function() {
                return 'CodeQuality';
            }
        };
        
        return CodeQuality;
    });
})();