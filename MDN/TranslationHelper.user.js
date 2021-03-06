// ==UserScript==
// @name        MDN Translation Helper
// @description MDNで翻訳を行う際に自動で色々します。
// @namespace   https://github.com/mozilla-japan/translation/
// @author      unarist
// @version     0.3
// @downloadURL https://raw.githubusercontent.com/mozilla-japan/translation/master/MDN/TranslationHelper.user.js
// @supportURL  https://github.com/mozilla-japan/translation/issues
// @match       https://developer.mozilla.org/*/docs/*
// ==/UserScript==

// TODO: 適用する処理を選べるように？
// TODO: 事前or事後の確認（diffを出せるとgood）
// TODO: 自動翻訳の充実
// TODO: ja以外の翻訳で起動しないように
// TODO: WISYWIGエディタを使う以上マークアップに細かいブレがあってパターンに合わないことがある
// TODO: 読みやすいように、全体の流れを先に持ってきたい（多分移動するだけ）
// TODO: BodyProcessorのメソッドを舐めて、処理の選択肢を提示したい

/** changelog **

0.3 (2017/02/25)
 addNameAttribute id属性が翻訳済みの場合はスキップ
 syncTags 既存のタグを全て削除するように（主に手動実行用）
 各種手動実行リンクを追加

*/

(function() {
    'use strict';

    if (!document.getElementById('localize-document')) return;

    class BodyProcessor {
        constructor() {
            this.src_str = $('.translate-source').text();
            this.editor = CKEDITOR.instances[Object.keys(CKEDITOR.instances)[0]];
            this.dest_str = this.editor.getData();
            this.work_str = this.dest_str;
        }
        save() {
            this.editor.setData(this.work_str);
        }
        resetBody() {
            // title: 翻訳のリセット
            // desc: 現在の翻訳文を破棄し、最新の英語版から全文をコピーします。

            this.work_str = this.src_str;
        }
        addNameAttribute() {
            // title: name属性の追加（id属性対策）
            // desc: 見出し翻訳時にid属性が日本語にならないように、name属性を追加します。既に翻訳されているものは処理しません。

            //this.work_str = this.work_str.replace(/<h(\d) id="(\w+)">/g, '<h$1 id="$2" name="$2">');
            var skipped = [];
            this.work_str = this.work_str.replace(/<h(\d) id="([^"]+)">/g, (src,lv,id) => {
                if (id.match(/[^A-Za-z0-9_\-]/)) {
                    console.log(`addNameAttribute: skipped ${src}`);
                    skipped.push(id);
                    return src;
                } else {
                    return `<h${lv} id="${id}" name="${id}">`;
                }
            });
            if (skipped.length) {
                alert('以下の見出しは既にidが翻訳済みだったため、name属性を追加しませんでした。\n・' + skipped.join('\n・'));
            }
        }
        applyKnownPhrase() {
            // title: 見出し等の自動翻訳
            // desc: セクション見出しや表の行・列見出しなどの定型句を翻訳します

            // foo, ba+r -> /<foo( [^>]*)?>ba+r</
            // TODO: URLを見て適用するルールを限定する？
            const patterns = [
                // common
                ['h2', 'Specifications', '仕様'],
                ['strong', 'Note:', '注:'],
                ['strong', 'Note', '注'],
                ['h2', 'Examples?', '例'],
                ['h2', 'Browser compatibility', 'ブラウザ実装状況'],
                ['h2', 'Notes', '注記'],
                ['h2', 'See also', '関連情報'],
                // common - compatibility table
                ['td', 'Basic support', '基本サポート'],
                ['th', 'Feature', '機能'],
                ['th', 'Specification', '仕様書'],
                ['th', 'Status', '策定状況'],
                ['th', 'Comment', 'コメント'],
                ['td', 'Initial (definition|specification)\.?', '初期定義'],
                // common - constant table
                ['th', 'Value', '値'],
                ['th', 'Associated constant', '定数'],
                ['th', 'Description', '説明'],
                // JavaScript API
                ['h2', 'Methods', 'メソッド'],
                ['h2', 'Properties', 'プロパティ'],
                ['h2', 'Syntax', '構文'],
                ['h3', 'Parameters', 'パラメータ'],
                // DOM Elements
                ['h3', 'Event handlers', 'イベントハンドラー'],
                // /docs/Web/HTML/Element
                // 要素には独自の用語・フレーズが多いので、後回し。
                // いくつかスクリプト最下部にコメントアウトで記載。
                ['h2', 'Attributes', '属性'],
                ['h2', 'Scripting', 'スクリプティング'],
                // Event reference /docs/Web/Events/
                ['h2', 'General info', '基本情報'],
                ['h2', 'Related Events', '関連するイベント'],
                ['dt', 'Specification', '仕様'],
                ['dt', 'Interface', 'インターフェイス'],
                ['dt', 'Bubbles', 'バブリング'],
                ['dt', 'Cancelable', 'キャンセル可能か'],
                ['dt', 'Target', 'ターゲット'],
                ['dt', 'Default Action', '既定の動作'],
                ['dd', 'None', 'なし']
            ];
            for (const pattern of patterns)
                this.work_str = this.work_str.replace(new RegExp(`(<${pattern[0]}(?: [^>]*)?>)${pattern[1]}<`, 'g'), `$1${pattern[2]}<`);
        }
        applyKnownSentence() {
            // title: 定型文の自動翻訳（β）
            // desc: 文章の自動翻訳を行います。今のところ継承周りの文言や The ... interface -> ... インターフェイスぐらいしかありません。

            // doesn't (implement|inherit) 周りのemの入れ子が適当っぽいので勝手に正規化
            // ※ HTML的には em の入れ子にも意味があるらしいが、
            //     意味を持って使っているようには見えないし、手作業での翻訳でも多分意識してない...
            let count = 0;
            const tmp = this.work_str.replace(/<\/?em>/g, m => {
                const n = (m[1] === '/') ? -1 : 1;
                count += n;
                if (count === 1 && n === 1) return m;
                else if (count === 0 && n === -1) return m;
                else return '';
            });
            if (count === 0) this.work_str = tmp;
            else console.log(`開始・終了タグの数が合わないのでスキップ: ${count}`);
            this.work_str = this.work_str.replace('</em><em>', '').replace('</em>.</p>', '.</em></p>');

            this.work_str = this.work_str.replace(/The (.+) interface neither implements?, nor inherits? any (property|method)\./g,
                                                  (m, p1, p2) => `${p1} インターフェイスが実装・継承する${p2[0] === 'p' ? 'プロパティ': 'メソッド'}はありません。`);
            this.work_str = this.work_str.replace(/The (.+) interface doesn't inherit any (property|method)\./g,
                                                  (m, p1, p2) => `${p1} インターフェイスが継承する${p2[0] === 'p' ? 'プロパティ': 'メソッド'}はありません。`);
            this.work_str = this.work_str.replace(/The (.+) interface doesn't implement any (property|method)\./g,
                                                  (m, p1, p2) => `${p1} インターフェイスが実装する${p2[0] === 'p' ? 'プロパティ': 'メソッド'}はありません。`);
            this.work_str = this.work_str.replace(/Inherits (methods|properties) from its parent, (.+)\./g,
                                                  (m, p1, p2) => `親である ${p2} から${p2[0] === 'p' ? 'プロパティ': 'メソッド'}を継承します。`);

            this.work_str = this.work_str.replace(/The ([<>/\w]+) interface/, '$1 インターフェイス');
        }
        applyLocalizedUrl() {
            // title: 記事URLを日本語版に修正
            // desc: /en-US/docs/ を /ja/docs/ に置き換えます。
            this.work_str = this.work_str.replace(/"\/en-US\/docs\//, '/ja/docs/');
        }
    }

    const Util = {
        setLocalizationInProgressFlag(value) {
            $('[name="localization_tags"][value="inprogress"').prop('checked', value);
        },
        setEditorialReviewFlag(value) {
            $('[name="review_tags"][value="editorial"').prop('checked', value);
        },
        syncTags() {
            // 既存のタグをすべて削除
            $('.tagit-choice').remove();

            // 英語版記事のタグをすべて追加
            const $tag_anchors = $('.tags a');
            const $tagit_input = $('.tagit input');
            $tag_anchors.each((i,e) => $tagit_input.val(e.innerText).blur());
        },
        getBaseRevisionId() {
            return $('#id_based_on').val();
        },
        setRevisionComment(str) {
            $('#id_comment').val(str);
        },
        insertRevisionComment(insertion) {
            const elem = $('#id_comment').get(0);
            const curtext = elem.value;
            const newpos = elem.selectionStart + insertion.length;
            elem.value = curtext.substr(0, elem.selectionStart) + insertion + curtext.substr(elem.selectionEnd);
            elem.setSelectionRange(newpos, newpos);
            elem.focus();
        }
    };

    if (location.pathname.endsWith('$translate')) {
        const processor = new BodyProcessor();
        processor.addNameAttribute();
        processor.applyKnownPhrase();
        processor.applyKnownSentence();
        processor.applyLocalizedUrl();
        processor.save();

        Util.setLocalizationInProgressFlag(false);
        Util.setEditorialReviewFlag(true);
        Util.syncTags();

        Util.setRevisionComment(`英語版 rev.${Util.getBaseRevisionId()} を翻訳`);
    }

    if (location.pathname.endsWith('$edit')) {
        // 原文にdiffが発生している場合のみ
        if ($('.revision-diff').length) {
            Util.setRevisionComment(`英語版 rev.${Util.getBaseRevisionId()} を反映`);
        }
    }

    const defs = [{
        target: '.guide-links',
        prepend: ' • ',
        label: 'Translation Helper',
        desc: 'MDN Translation Helper による自動処理を適用します',
        action: () => {
            if (!confirm('以下の処理を適用します:\n・name属性の追加\n・見出し等の自動翻訳\n・定型文の自動翻訳\n・記事URLを日本語版に修正')) return;
            const processor = new BodyProcessor();
            processor.addNameAttribute();
            processor.applyKnownPhrase();
            processor.applyKnownSentence();
            processor.applyLocalizedUrl();
            processor.save();
        }
    }, {
        target: '.guide-links',
        prepend: ' • ',
        label: '初期化',
        desc: 'エディタの内容を最新の原文で置き換えます',
        action: () => {
            if (!confirm('エディタの内容を最新の原文で置き換えます。よろしいですか？')) return;
            const processor = new BodyProcessor();
            processor.resetBody();
            processor.save();
        }
    }, {
        target: '#page-tags > h3',
        append: ' ',
        label: '[英語版のタグと揃える]',
        desc: '現在設定されているタグを全て削除し、英語版のタグをコピーします',
        action: () => confirm('現在設定されているタグは全て削除されます。よろしいですか？') && Util.syncTags()
    }, {
        target: '#page-comment > h3',
        append: ' ',
        label: '[英語版のリビジョン番号を挿入]',
        desc: '翻訳元である英語版のリビジョン番号を、カーソル位置に挿入します',
        action: () => Util.insertRevisionComment("rev." + Util.getBaseRevisionId())
    }];

    for (const def of defs) {
        const elem = Object.assign(document.createElement('a'), {
            href: 'javascript:void(0)',
            style: 'font-size: 1rem',
            title: def.desc,
            textContent: def.label,
            onclick: def.action
        });

        const targetElem = document.querySelector(def.target);
        if (def.append) {
            targetElem.appendChild(document.createTextNode(def.append));
            targetElem.appendChild(elem);
        } else {
            targetElem.insertBefore(document.createTextNode(def.prepend), targetElem.firstChild);
            targetElem.insertBefore(elem, targetElem.firstChild);
        }
    }
})();
/*
Content categories	コンテンツカテゴリ
Permitted content	許可された内容
Tag omission	タグの省略
Permitted parents	許可された親要素
Permitted ARIA roles	許可された ARIA ロール
DOM interface	DOM インターフェイス

Any	全て
flow content	フローコンテンツ
palpable content	パルパブルコンテンツ
sectioning content	セクショニングコンテンツ
heading content	ヘディングコンテンツ
phrasing content	フレージングコンテンツ
embedded content	埋め込みコンテンツ
interactive content	インタラクティブコンテンツ
form-associated content	フォーム関連コンテンツ

None, both the starting and ending tag are mandatory.
不可。開始と終了タグの両方が必要。
None, it is an {{Glossary("empty element")}}.
なし。これは{{Glossary("empty element", "空要素")}}です。
Must have a start tag and must not have an end tag.
開始タグは必須。終了タグを記述してはならない。

This element includes the <a href="/en-US/docs/Web/HTML/Global_attributes">global attributes</a>.
この要素は<a href="/ja/docs/Web/HTML/Global_attributes">グローバル属性</a>および以下の属性をサポートしています。
*/
