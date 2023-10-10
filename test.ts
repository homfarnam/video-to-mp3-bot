interface UserData {
  [key: string]: {
    [key: number]: number;
  };
}

const data: UserData = {
  mohammad: {
    2: 0,
    3: 0,
    4: 1,
    5: 0,
    6: 0,
    7: 0,
  },
  amin: {
    2: 1,
    3: 1,
    4: 1,
    5: 0,
    6: 1,
    7: 1,
  },
  Mohamadamin: {
    2: 1,
    3: 0,
    4: 0,
    5: 1,
    6: 0,
    7: 1,
  },
  asgar: {
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 1,
  },
};

function doGet(e) {
  // دریافت شناسه کاربر از URL درخواست
  var userID = e.parameter["userID"];

  // دریافت داده‌های کاربر
  var spreadsheet = SpreadsheetApp.openById(
    "11kxwd46-7k6V_G7zc4fU3F037Mff_IezL_3E0yVZi5w"
  );
  //var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName("Sheet1");
  var dataRange = sheet.getDataRange();

  // پیدا کردن محصولاتی که کاربر قبلاً دیده است
  var viewedProducts = [];
  for (var i = 0; i < dataRange.getValues().length; i++) {
    if (dataRange.getValues()[i][0] == userID) {
      viewedProducts.push(dataRange.getValues()[i][1]);
    }
  }

  // پیدا کردن کاربران مشابه
  var similarUsers = [];
  for (var i = 0; i < viewedProducts.length; i++) {
    for (var j = 0; j < dataRange.getValues().length; j++) {
      if (
        dataRange.getValues()[i][1] == viewedProducts[i] &&
        similarUsers.includes(dataRange.getValues()[j][0]) != true &&
        dataRange.getValues()[j][0] != userID
      ) {
        similarUsers.push(dataRange.getValues()[j][0]);
      }
    }
  }

  var allProducts = [];
  for (var i = 0; i < dataRange.getValues().length; i++) {
    if (allProducts.includes(dataRange.getValues()[i][1]) != true) {
      allProducts.push(dataRange.getValues()[i][1]);
    }
  }

  const matrix = {};

  for (let i = 0; i < similarUsers.length; i++) {
    const rowName = similarUsers[i];
    matrix[rowName] = {}; // Create an empty object for the row
    for (let j = 0; j < allProducts.length; j++) {
      const colName = allProducts[j];
      matrix[rowName][colName] = 0; // Initialize each cell with 0
    }
  }

  for (var i = 0; i < similarUsers.length; i++) {
    const name = similarUsers[i];
    for (var j = 0; j < dataRange.getValues().length; j++) {
      if (dataRange.getValues()[j][0] == name) {
        const product = dataRange.getValues()[j][1];
        matrix[name][product] = 1;
      }
    }
  }

  for (var i = 0; i < viewedProducts.length; i++) {
    for (var j = 0; j < similarUsers.length; j++) {
      for (var k = 0; k < allProducts.length; k++) {
        if (matrix[j].hasOwnProperty(viewedProducts[i])) {
          if (matrix[j][k] == 1) {
            matrix[j][k] = 0;
          } else {
            matrix[j][k] = 1;
          }
        }
      }
    }
  }

  // برگرداندن خروجی JSON
  var output = ContentService.createTextOutput(JSON.stringify(matrix));
  output.setMimeType(ContentService.MimeType.JSON);

  // برگرداندن خروجی
  return output;
}
