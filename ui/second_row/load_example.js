// main/deep_parse/second_row/load_example.js
(function() {
    const exampleText = `The quick brown fox jumps over the lazy dog. Although it was raining, she decided to go for a walk, and she enjoyed the fresh air.`;
    
    function loadExample() {
        const textarea = document.getElementById('articleInput');
        if (!textarea) {
            console.warn('文本输入框未找到');
            showToast('文本输入框未找到');
            return;
        }
        textarea.value = exampleText;
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
        showToast('示例文章已加载');
    }
    
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2000);
        }
    }
    
    window.LoadExample = { load: loadExample, getExampleText: () => exampleText };
    window.onLoadExample = loadExample;
})();