import { erroDoVideo, videoValido } from './video';

describe('link de vídeo', () => {
  it('só https do YouTube', () => {
    expect(videoValido('https://youtu.be/abc')).toBe(true);
    expect(videoValido('https://www.youtube.com/watch?v=x')).toBe(true);
    expect(videoValido('http://youtu.be/abc')).toBe(false);
    expect(videoValido('javascript:alert(1)')).toBe(false);
    expect(videoValido('https://youtube.com.mal.com/x')).toBe(false);
    expect(videoValido('https://user@youtu.be/x')).toBe(false);
  });

  it('vazio é aceito (vídeo é opcional)', () => {
    expect(erroDoVideo('')).toBeNull();
    expect(erroDoVideo('https://vimeo.com/1')).toBe('Use um link https do YouTube.');
  });
});
