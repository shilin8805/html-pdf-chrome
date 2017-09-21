'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-unused-expression
const chai = require("chai");
const chromeLauncher = require("chrome-launcher");
const fs = require("fs");
const mockFs = require("mock-fs");
const path = require("path");
const PDFParser = require("pdf2json");
const sinon = require("sinon");
const stream_1 = require("stream");
const tcpPortUsed = require("tcp-port-used");
const HtmlPdf = require("../src");
// tslint:disable:no-var-requires
chai.use(require('chai-string'));
chai.use(require('sinon-chai'));
// tslint:enable:no-var-requires
const expect = chai.expect;
describe('HtmlPdf', () => {
    describe('create', () => {
        let port;
        let chrome;
        before(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // Start Chrome and wait for it to start listening for connections.
                chrome = yield chromeLauncher.launch({
                    chromeFlags: [
                        '--disable-gpu',
                        '--headless',
                    ],
                });
                port = chrome.port;
                yield tcpPortUsed.waitUntilUsed(port);
            }
            catch (err) {
                yield chrome.kill();
                throw err;
            }
        }));
        after(() => __awaiter(this, void 0, void 0, function* () {
            yield chrome.kill();
        }));
        it('should spawn Chrome and generate a PDF', () => __awaiter(this, void 0, void 0, function* () {
            const result = yield HtmlPdf.create('<p>hello!</p>');
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
        }));
        it('should handle a Chrome launch failure', () => __awaiter(this, void 0, void 0, function* () {
            let launchStub;
            const error = new Error('failed!');
            try {
                launchStub = sinon.stub(chromeLauncher, 'launch').callsFake(() => Promise.reject(error));
                yield HtmlPdf.create('<p>hello!</p>');
                expect.fail();
            }
            catch (err) {
                expect(err).to.equal(error);
            }
            finally {
                launchStub.restore();
            }
        }));
        it('should use running Chrome to generate a PDF (specify port)', () => __awaiter(this, void 0, void 0, function* () {
            const launchStub = sinon.stub(chromeLauncher, 'launch');
            try {
                const result = yield HtmlPdf.create('<p>hello!</p>', { port });
                expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                expect(launchStub).to.not.have.been.called;
                const pdf = yield getParsedPdf(result.toBuffer());
                expect(pdf.getRawTextContent()).to.startWith('hello!');
            }
            finally {
                launchStub.restore();
            }
        }));
        it('should use running Chrome to generate a PDF (specify host and port)', () => __awaiter(this, void 0, void 0, function* () {
            const launchStub = sinon.stub(chromeLauncher, 'launch');
            try {
                const result = yield HtmlPdf.create('<p>hello!</p>', { host: 'localhost', port });
                expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                expect(launchStub).to.not.have.been.called;
                const pdf = yield getParsedPdf(result.toBuffer());
                expect(pdf.getRawTextContent()).to.startWith('hello!');
            }
            finally {
                launchStub.restore();
            }
        }));
        it('should generate a PDF with Chrome options', () => __awaiter(this, void 0, void 0, function* () {
            const options = {
                port,
                printOptions: {
                    landscape: true,
                    displayHeaderFooter: true,
                },
            };
            const result = yield HtmlPdf.create('<p>hello!</p>', options);
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
        }));
        it('should timeout', () => __awaiter(this, void 0, void 0, function* () {
            const options = {
                port,
                timeout: 0,
            };
            try {
                yield HtmlPdf.create('<p>hello!</p>', options);
                expect.fail();
            }
            catch (err) {
                expect(err.message).to.equal('HtmlPdf.create() timed out.');
            }
        }));
        it('should generate a PDF with external JavaScript', () => __awaiter(this, void 0, void 0, function* () {
            const html = `
        <html>
          <head>
            <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js"></script>
          </head>
          <body>
            <div id="test">Failed!</div>
            <script>
              $('#test').text('Passed!');
            </script>
          </body>
        </html>
      `;
            const result = yield HtmlPdf.create(html, { port });
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            const pdf = yield getParsedPdf(result.toBuffer());
            expect(pdf.getRawTextContent()).to.startWith('Passed!');
        }));
        it('should generate a PDF with external CSS', () => __awaiter(this, void 0, void 0, function* () {
            // #test:before{content:'Passed!';}
            const html = `
        <html>
          <head>
            <link rel="stylesheet" href="data:text/css;charset=utf-8;base64,I3Rlc3Q6YmVmb3Jle2NvbnRlbnQ6J1Bhc3NlZCEnO30=">
          </head>
          <body>
            <div id="test"></div>
          </body>
        </html>
      `;
            const result = yield HtmlPdf.create(html, { port });
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            const pdf = yield getParsedPdf(result.toBuffer());
            expect(pdf.getRawTextContent()).to.startWith('Passed!');
        }));
        it('should generate a PDF with multiple pages', () => __awaiter(this, void 0, void 0, function* () {
            const html = `
        <html>
          <body>
            <div style="page-break-after:always">Page 1</div>
            <div>Page 2</div>
          </body>
        </html>
      `;
            const result = yield HtmlPdf.create(html, { port });
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            const pdf = yield getParsedPdf(result.toBuffer());
            expect(pdf.getRawTextContent()).to.contain('Page (0) Break').and.to.contain('Page (1) Break');
        }));
        it('should generate a PDF from a local file', () => __awaiter(this, void 0, void 0, function* () {
            const filePath = path.join('file://', __dirname, '../../test/test.html');
            const result = yield HtmlPdf.create(filePath, { port });
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            const pdf = yield getParsedPdf(result.toBuffer());
            expect(pdf.getRawTextContent()).to.startWith('Passed!');
        }));
        it('should generate a PDF from an external site', () => __awaiter(this, void 0, void 0, function* () {
            const result = yield HtmlPdf.create('https://m.facebook.com/', { port });
            expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            const pdf = yield getParsedPdf(result.toBuffer());
            expect(pdf.getRawTextContent()).to.contain('Facebook');
        }));
        describe('CompletionTrigger', () => {
            const timeoutErrorMessage = 'CompletionTrigger timed out.';
            describe('Timer', () => {
                const html = `
          <html>
            <body>
              <div id="test">Failed!</div>
              <script>
                setTimeout(() => {
                  document.getElementById('test').innerHTML = 'Passed!';
                }, 100);
              </script>
            </body>
          </html>
        `;
                it('should generate prematurely without a CompletionTrigger', () => __awaiter(this, void 0, void 0, function* () {
                    const result = yield HtmlPdf.create(html, { port });
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Failed!');
                }));
                it('should generate correctly after being triggered', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Timer(200),
                    };
                    const result = yield HtmlPdf.create(html, options);
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Passed!');
                }));
            });
            describe('Event', () => {
                const html = `
          <html>
            <body>
              <div id="test">Failed!</div>
              <script>
                setTimeout(() => {
                  document.getElementById('test').innerHTML = 'Passed!';
                  document.body.dispatchEvent(new Event('myEvent'));
                }, 100);
              </script>
            </body>
          </html>
        `;
                it('should generate prematurely without a CompletionTrigger', () => __awaiter(this, void 0, void 0, function* () {
                    const result = yield HtmlPdf.create(html, { port });
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Failed!');
                }));
                it('should time out', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Event('myEvent', null, 1),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should time out from listening to the wrong event', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Event('myEvent', '#test', 200),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should generate correctly after being triggered', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Event('myEvent'),
                    };
                    const result = yield HtmlPdf.create(html, options);
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Passed!');
                }));
            });
            describe('Callback', () => {
                const html = `
          <html>
            <body>
              <div id="test">Failed!</div>
              <script>
                setTimeout(() => {
                  document.getElementById('test').innerHTML = 'Timeout!';
                  if (window.htmlPdfCb) {
                    document.getElementById('test').innerHTML = 'Callback!';
                    htmlPdfCb();
                  }
                }, 100);
              </script>
            </body>
          </html>
        `;
                it('should generate prematurely without a CompletionTrigger', () => __awaiter(this, void 0, void 0, function* () {
                    const result = yield HtmlPdf.create(html, { port });
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Failed!');
                }));
                it('should time out', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Callback(null, 1),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should time out from listening to the wrong callback', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Callback('wrongCb', 200),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should generate correctly after being triggered', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Callback(),
                    };
                    const result = yield HtmlPdf.create(html, options);
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Callback!');
                }));
            });
            describe('Element', () => {
                const html = `
          <html>
            <body>
              <div id="test">Failed!</div>
              <script>
                setTimeout(() => {
                  const inserted = document.createElement('div');
                  inserted.id = 'inserted';
                  inserted.innerText = 'Passed!';
                  document.body.insertBefore(inserted, document.getElementById('test'));
                }, 100);
              </script>
            </body>
          </html>
        `;
                it('should generate prematurely without a CompletionTrigger', () => __awaiter(this, void 0, void 0, function* () {
                    const result = yield HtmlPdf.create(html, { port });
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Failed!');
                }));
                it('should time out', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Element('div#inserted', 1),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should time out from listening for the wrong element', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Element('div#derp', 200),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should generate correctly after being triggered', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Element('div#inserted'),
                    };
                    const result = yield HtmlPdf.create(html, options);
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Passed!');
                }));
            });
            describe('Variable', () => {
                const html = `
          <html>
            <body>
              <div id="test">Failed!</div>
              <script>
                setTimeout(() => {
                  document.getElementById('test').innerHTML = 'Variable!';
                  htmlPdfDone = true;
                }, 100);
              </script>
            </body>
          </html>
        `;
                it('should generate prematurely without a CompletionTrigger', () => __awaiter(this, void 0, void 0, function* () {
                    const result = yield HtmlPdf.create(html, { port });
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Failed!');
                }));
                it('should time out', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Variable(null, 1),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should time out from listening to the wrong variable', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Variable('wrongVar', 200),
                    };
                    try {
                        yield HtmlPdf.create(html, options);
                        expect.fail();
                    }
                    catch (err) {
                        expect(err.message).to.equal(timeoutErrorMessage);
                    }
                }));
                it('should generate correctly after being triggered', () => __awaiter(this, void 0, void 0, function* () {
                    const options = {
                        port,
                        completionTrigger: new HtmlPdf.CompletionTrigger.Variable(),
                    };
                    const result = yield HtmlPdf.create(html, options);
                    expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
                    const pdf = yield getParsedPdf(result.toBuffer());
                    expect(pdf.getRawTextContent()).startsWith('Variable!');
                }));
            });
        });
    });
    describe('CreateResult', () => {
        describe('constructor', () => {
            it('should instanciate', () => {
                const result = new HtmlPdf.CreateResult('');
                expect(result).to.be.an.instanceOf(HtmlPdf.CreateResult);
            });
        });
        describe('toBase64', () => {
            it('should output a base64 string', () => {
                const cr = new HtmlPdf.CreateResult('dGVzdA==');
                expect(cr.toBase64()).to.equal('dGVzdA==');
            });
        });
        describe('toBuffer', () => {
            it('should output a Buffer', () => {
                const cr = new HtmlPdf.CreateResult('dGVzdA==');
                expect(cr.toBuffer()).to.deep.equal(Buffer.from('test'));
            });
        });
        describe('toStream', () => {
            it('should output a Readable Stream', () => {
                const cr = new HtmlPdf.CreateResult('dGVzdA==');
                const stream = cr.toStream();
                expect(stream).to.be.an.instanceOf(stream_1.Readable);
            });
            it('should output a valid Stream', (done) => {
                const cr = new HtmlPdf.CreateResult('dGVzdA==');
                const stream = cr.toStream();
                let bytes = new Buffer('');
                stream.on('data', (chunk) => {
                    bytes = Buffer.concat([bytes, chunk]);
                });
                stream.on('end', () => {
                    try {
                        expect(bytes).to.deep.equal(cr.toBuffer());
                        done();
                    }
                    catch (err) {
                        done(err);
                    }
                });
            });
        });
        describe('toFile', () => {
            it('should output a file', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    mockFs({
                        myDir: {},
                    });
                    const cr = new HtmlPdf.CreateResult('dGVzdA==');
                    const filePath = 'myDir/file.pdf';
                    yield cr.toFile(filePath);
                    const stats = fs.statSync(filePath);
                    expect(stats.isFile()).to.be.true;
                    expect(stats.isDirectory()).to.be.false;
                    expect(stats.size).to.be.greaterThan(0);
                }
                finally {
                    mockFs.restore();
                }
            }));
            it('should fail output to a nonexistent directory', () => __awaiter(this, void 0, void 0, function* () {
                try {
                    mockFs();
                    const cr = new HtmlPdf.CreateResult('dGVzdA==');
                    yield cr.toFile('myDir/file.pdf');
                    expect.fail();
                }
                catch (err) {
                    expect(err.message).to.contain('no such file or directory');
                }
                finally {
                    mockFs.restore();
                }
            }));
        });
    });
});
function getParsedPdf(buffer) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser(null, 1);
            pdfParser.on('pdfParser_dataError', (err) => reject(err.parserError));
            pdfParser.on('pdfParser_dataReady', () => resolve(pdfParser));
            pdfParser.parseBuffer(buffer);
        });
    });
}

//# sourceMappingURL=index.js.map
