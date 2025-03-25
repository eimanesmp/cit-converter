const fs = require('fs').promises;
const path = require('path');

fs.open().then(b => {
    b.read().then(c => {
        c.bytesRead.toString
    })
})