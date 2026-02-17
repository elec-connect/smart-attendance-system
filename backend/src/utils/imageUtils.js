const sharp = require('sharp');

class ImageUtils {
  static async processImage(buffer, options = {}) {
    const {
      width = 640,
      height = 480,
      quality = 85,
      grayscale = false
    } = options;
    
    let imageProcessor = sharp(buffer);
    
    if (grayscale) {
      imageProcessor = imageProcessor.grayscale();
    }
    
    return await imageProcessor
      .resize(width, height, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality,
        mozjpeg: true 
      })
      .normalize()
      .toBuffer();
  }

  static base64ToBuffer(base64String) {
    if (base64String.includes(',')) {
      base64String = base64String.split(',')[1];
    }
    return Buffer.from(base64String, 'base64');
  }

  static bufferToBase64(buffer, mimeType = 'image/jpeg') {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  static validateImage(buffer, maxSize = 5 * 1024 * 1024) {
    if (buffer.length > maxSize) {
      throw new Error(`Image trop volumineuse (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    const magicNumber = buffer.slice(0, 4).toString('hex').toLowerCase();
    const validFormats = {
      'ffd8ffe0': 'jpg',
      'ffd8ffe1': 'jpg',
      'ffd8ffe2': 'jpg',
      'ffd8ffe3': 'jpg',
      'ffd8ffe8': 'jpg',
      '89504e47': 'png',
      '47494638': 'gif'
    };
    
    if (!validFormats[magicNumber]) {
      throw new Error('Format non supporté (JPG, PNG, GIF uniquement)');
    }
    
    return true;
  }
}

module.exports = ImageUtils;