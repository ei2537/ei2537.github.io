class ImageLoader {
    constructor() {
        this.images = {};
    }

    /**
     * 画像を読み込む
     * @param {string} key - 呼び出す時の名前 (例: 'player')
     * @param {string} src - ファイルパス
     * @returns {Promise}
     */
    load(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[key] = img;
                resolve(img);
            };
            img.onerror = (e) => {
                console.error(`Failed to load image: ${src}`, e);
                reject(e);
            };
            img.src = src;
        });
    }

    get(key) {
        return this.images[key];
    }
}