// load_example.js - 加载示例文章
// 提供多篇经典英文示例，一键填入输入框，方便快速体验
(function() {
    const examples = [
        {
            name: 'The Fox and the Crow（狐狸与乌鸦）',
            text: `The Fox and the Crow

A Fox once saw a Crow fly off with a piece of cheese in its beak and settle on a branch of a tree. "That's for me, as I am a Fox," said Master Reynard, and he walked up to the foot of the tree.

"Good day, Mistress Crow," he cried. "How well you are looking to-day: how glossy your feathers; how bright your eye. I feel sure your voice must surpass that of other birds, just as your figure does; let me hear but one song from you that I may greet you as the Queen of Birds."

The Crow lifted up her head and began to caw her best, but the moment she opened her mouth the piece of cheese fell to the ground, only to be snapped up by Master Fox.

"That will do," said he. "That was all I wanted. In exchange for your cheese I will give you a piece of advice for the future: Do not trust flatterers."`
        },
        {
            name: 'Of Studies（论读书）',
            text: `Of Studies

Studies serve for delight, for ornament, and for ability. Their chief use for delight is in privateness and retiring; for ornament, is in discourse; and for ability, is in the judgment and disposition of business.

For expert men can execute, and perhaps judge of particulars, one by one; but the general counsels, and the plots and marshalling of affairs, come best from those that are learned. To spend too much time in studies is sloth; to use them too much for ornament is affectation; to make judgment wholly by their rules is the humor of a scholar.

They perfect nature, and are perfected by experience: for natural abilities are like natural plants, that need pruning by study; and studies themselves do give forth directions too much at large, except they be bounded in by experience.

Crafty men contemn studies, simple men admire them, and wise men use them; for they teach not their own use; but that is a wisdom without them, and above them, won by observation.

Read not to contradict and confute; nor to believe and take for granted; nor to find talk and discourse; but to weigh and consider.

Some books are to be tasted, others to be swallowed, and some few to be chewed and digested; that is, some books are to be read only in parts; others to be read, but not curiously; and some few to be read wholly, and with diligence and attention.

Reading maketh a full man; conference a ready man; and writing an exact man. And therefore, if a man write little, he had need have a great memory; if he confer little, he had need have a present wit; and if he read little, he had need have much cunning, to seem to know that he doth not.

Histories make men wise; poets witty; the mathematics subtle; natural philosophy deep; moral grave; logic and rhetoric able to contend. Abeunt studia in mores.`
        },
        {
            name: 'The Wind and the Sun（北风与太阳）',
            text: `The Wind and the Sun

The Wind and the Sun were disputing which was the stronger. Suddenly they saw a traveller coming down the road, and the Sun said: "I see a way to decide our dispute. Whichever of us can cause that traveller to take off his cloak shall be regarded as the stronger. You begin."

So the Sun retired behind a cloud, and the Wind began to blow as hard as it could upon the traveller. But the harder he blew the more closely did the traveller wrap his cloak round him, till at last the Wind had to give up in despair.

Then the Sun came out and shone in all his glory upon the traveller, who soon found it too hot to walk with his cloak on.

Kindness effects more than severity.`
        },
        {
            name: 'The Hare and the Tortoise（龟兔赛跑）',
            text: `The Hare and the Tortoise

A Hare was making fun of the Tortoise one day for being so slow.

"Do you ever get anywhere?" he asked with a mocking laugh.

"Yes," replied the Tortoise, "and I get there sooner than you think. I'll run you a race and prove it."

The Hare was much amused at the idea of running a race with the Tortoise, but for the fun of the thing he agreed. So the Fox, who had consented to act as judge, marked the distance and started them off.

The Hare was soon far out of sight, and to make the Tortoise feel very deeply how ridiculous it was for him to try a race with a Hare, he lay down beside the course to take a nap until the Tortoise should catch up.

The Tortoise meanwhile kept going slowly but steadily, and, after a time, passed the place where the Hare was sleeping. But the Hare slept on very peacefully; and when at last he did wake up, the Tortoise was near the goal. The Hare now ran his swiftest, but he could not overtake the Tortoise in time.

The race is not always to the swift.`
        },
        {
            name: 'The City Mouse and the Country Mouse（城市老鼠与乡下老鼠）',
            text: `The City Mouse and the Country Mouse

Now you must know that a Country Mouse had a friend in town, and one day the friend came to visit him. The Country Mouse gave him a hearty welcome, and shared his dinner of peas and roots with him.

The City Mouse nibbled a little, but was not pleased with the fare, and said: "My poor dear friend, you live no better than the ants. Come with me and I will show you how to live."

So they set off together to the town, and came at last to the great house where the City Mouse lived. There were plenty of fine things to eat, and the two mice made themselves merry.

But just as they were going to begin, the door opened with a great noise and in came two great dogs. The mice were so frightened that they ran away as fast as they could, and did not stop till they were quite safe in the fields again.

"Good-bye, cousin," said the Country Mouse, "I am going back to my simple life. Better a crust with peace than a feast with fear."`
        }
    ];

    function loadExample() {
        const textarea = document.getElementById('articleInput');
        if (!textarea) {
            console.warn('文本输入框未找到');
            showToast('文本输入框未找到');
            return;
        }
        // 随机选一篇示例文章
        const pick = examples[Math.floor(Math.random() * examples.length)];
        textarea.value = pick.text;
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
        showToast('已加载示例：' + pick.name);
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerText = msg;
            toast.style.opacity = '1';
            setTimeout(() => toast.style.opacity = '0', 2500);
        }
    }

    window.LoadExample = { load: loadExample, getExampleText: () => examples[0].text, getAllExamples: () => examples };
    window.onLoadExample = loadExample;
})();
