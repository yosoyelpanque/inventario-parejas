const green={50:'#EDF5F1',100:'#E4EFEB',200:'#CEDFD7',300:'#9BBDB1',400:'#408D76',500:'#006847',600:'#03564B',700:'#03564B',800:'#033E3C',900:'#033E3C'};
const copper={50:'#FBF1E7',100:'#F5E4D3',200:'#E8C9A9',300:'#E09B61',400:'#C48D5C',500:'#A35C2B',600:'#8B4D24',700:'#78411F',800:'#65391F',900:'#534741'};
const wine={50:'#FDF1F3',100:'#FBEAEC',200:'#F2C9CF',300:'#E898A4',400:'#D44961',500:'#CE1126',600:'#A51931',700:'#721738',800:'#721738',900:'#55142B'};
module.exports = {content:['./index.html','./src/**/*.js'],theme:{extend:{colors:{indigo:wine,blue:wine,purple:wine,green,orange:copper,yellow:copper,pink:wine,red:wine}}},plugins:[]};
