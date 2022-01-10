//Hyper parameters
let number_trees = 10; //number of trees 
let max_depth = 3; //Max Depth for each tree

//Constant
const dimensions = 1; //number of readings (features) for algorithm
const min_read=0; //minimum value for readings (will be used for scaling)
const max_read=6000; //maximum value for readings (will be used for scaling) 

const Application_key="qm3OTDvWXHGRKQKV1641179705310lightAnomaly_app";
const ApplicationID = 108;

const anomaly_thresh=0.5; //threshold for anomaly probability
const season1Months = [1,2,3,4,5,6]; //Season 1 months
const season2Months = [7,8,9,10,11,12]; //Season 2 months
const weekDays = [1,2,3,4,5]; //WeekDays
const weekEnds = [6,7]; //WeekEnd Days

//Cached Sensor IDs
const Season1_WeekDays_cashedSensor_ID = 0;
const Season1_WeekEnd_cashedSensor_ID = 0;
const Season2_WeekDays_cashedSensor_ID = 0;
const Season2_WeekEnd_cashedSensor_ID = 403;

const Season2_WeekEnd_Day_cashedSensor_ID = 406;
const Season2_WeekEnd_Night_cashedSensor_ID = 407;


// Variables Declaration
let HSTree_list; //List of the trees
let dataList_name; //Name of the DataList according to season

//cachedSensorData
let cachedSensorData; //Data from cached Sensor
let FirstTraining; // Default: 1 Variable in cached sensor to control training start 
let TrainingComplete; // Default: 0 Variable in cached sensor to control training complete
let lastPointInSeason_sensor; // Default: 0 Variable in cached sensor to control if season ended, 1 if season ended else 0
let FirstWeek; // Default: 1 variable in cached sensor to control if we are in first week so we are training
let number_of_points_counter; // Default: 0 variable in cached sensor to count while training

let pointAnomaly; // 1 if point is anomaly and 0 if normal point
let pointScore; // claculated score of the point
let anomaly_prob; // point anomaly probability

let season; // variable with current season

let lastPointInSeason_normal = 0; //variable to indicate last point in sensor

let dataListIndex = 0; //index for datalist to control hours
let score_list = []; //array for scores
let referenceMasses = []; //array for reference masses

//read current readings from sensor

// reading names
let sensor_readings = Sensor.profile.SensorReading;
let sensor_readings_names = sensor_readings.split(",");

//number of readings
let sensor_readings_count = sensor_readings_names.length;

// reading values
let readings = JSON.stringify(Sensor.reading);
let readings_object = JSON.parse(readings); //parse reading values

// input data for the algorithm => LuxValue
let input_data =[]; //array for input data
input_data.push(parseFloat(Sensor.reading.currentLuxValue));

//Normalize input data for the algorithm
let normalized_input_data = NormalizeInputData(input_data, min_read, max_read);

/*
var today = new Date();
const currentHour = parseInt(today.getHours());
const currentDay = parseInt(today.getDay());
const currentMonth = parseInt(today.getMonth());
*/

const currentMonth = parseInt(8);
const currentDay = parseInt(2);
const currentHour = parseInt(18);

//check to get season
switch (true) {
case ((season1Months.includes(currentMonth)) && (weekDays.includes(currentDay))):{
    // season1 week days
    season = "season1 week days";
    dataList_name = 'Season1_WeekDays';
    cachedSensorID = Season1_WeekDays_cashedSensor_ID;
    break;
}
case ((season1Months.includes(currentMonth)) && (weekEnds.includes(currentDay))) :{
    // season1 Week End
    season = "season1 Week End";
    dataList_name = 'Season1_WeekEnd';
    cachedSensorID = Season1_WeekEnd_cashedSensor_ID;
    break;
}
case ((season2Months.includes(currentMonth)) && (weekDays.includes(currentDay))):{
    // season2 week days
    season = "season2 week days";
    dataList_name = 'Season2_WeekDays';
    cachedSensorID = Season2_WeekDays_cashedSensor_ID;
    break;
}
case ((season2Months.includes(currentMonth)) && (weekEnds.includes(currentDay))) :{
    // season2 Week End
    season = "season2 Week End";
    dataList_name = 'Season2_WeekEnd';
    cachedSensorID = Season2_WeekEnd_cashedSensor_ID;
    break;
}
}

console.log(season);

// Add Part of hours in day 
// we will train on two windows in day [day, night]
// Day from 6 AM to 5 PM and rest for night

let hourRanges = [6,17];
switch (true) {
case ((currentHour > hourRanges[0]) && (currentHour <= hourRanges[1])):{
    // We are in day
    console.log("Day");
    season = "Day";
    dataListIndex = 0;
    cachedSensorID = Season2_WeekEnd_Day_cashedSensor_ID;
    //cached sensor
    if (currentHour == hourRanges[1] ) {
      //stop Training
      lastPointInSeason_normal = 1;
    }
    break;
}
case ((currentHour <= hourRanges[0]) || (currentHour > hourRanges[1])):{
    // We are in night
    console.log("night");
    season = "night";
    dataListIndex = 1;
    cachedSensorID = Season2_WeekEnd_Night_cashedSensor_ID;
    // cached sensor
    if (currentHour == hourRanges[0] ) {
      //stop Training
      lastPointInSeason_normal = 1;
    }
    break;
}

}

/*
//check if current season will end
if (currentDay == weekDays[weekDays.length - 1]) {
  //last day in week days
  if (currentHour >= 23) {
    //last hour in season
    lastPointInSeason_normal = 1; //End the season
  }
  
} else if (currentDay == weekEnds[weekEnds.length - 1]) {
  //last day in week ends
  if (currentHour >= 23) {
    //last hour in season
    lastPointInSeason_normal = 1; //End the season
  }
}
*/
// FirstTraining,TrainingComplete,lastPointInSeason_sensor,FirstWeek,number_of_points_counter
// Data from cachedSensors
CachedSensorGetAsync(cachedSensorID)
  .then((result_CachedSensor) =>{
    // get data and parse
    cachedSensorData = JSON.parse(result_CachedSensor);
    // get the variables from the cached sensor to control
    FirstTraining = parseInt(cachedSensorData.FirstTraining);
    TrainingComplete = parseInt(cachedSensorData.TrainingComplete);
    lastPointInSeason_sensor = parseInt(cachedSensorData.lastPointInSeason_sensor);
    FirstWeek = parseInt(cachedSensorData.FirstWeek);
    number_of_points_counter = parseInt(cachedSensorData.number_of_points_counter);
    // reset lastPointInSeason_sensor to 0 if first day
    if (currentDay == weekDays[0] || currentDay == weekEnds[0]){
      lastPointInSeason_sensor = 0;
      if (TrainingComplete == 1) {
         // we are not in the first week
         FirstWeek = 0;
      }
    }
  })
  
  .then(() => {
    //check if we are at start // we will start training and build trees
    if (FirstTraining == 1) {
      //create trees and return them in HSTree_list
      HSTree_list = GetTreesList(number_trees, dimensions, max_depth);
      //update in trees with the current reading (input data)
      GetTreesFirstWindow(HSTree_list, normalized_input_data);
      //Add the trees to datalist
      let to_add_val = JSON.stringify(HSTree_list);
      DataListAddAsync(dataList_name, to_add_val).then(() => {
        FirstTraining = 0; //we finished first point and built trees
        number_of_points_counter += 1;
        //Update cached sensor //post sensor data
        PostSensorDataAsync(cachedSensorID,FirstTraining,TrainingComplete,lastPointInSeason_sensor,FirstWeek,number_of_points_counter).then(() => {
          event.end();
        }).catch((error) => {
        event.error(error);
      });
    });
           
    }
    //still training //read DataList
    else if (TrainingComplete == 0){
      console.log("training");
      // we are still training in first week but the tree is already built
      // we will make update in existing trees reference mass
      //Get the trees from DataList
      DataListGetAsync(dataList_name).then((result) => {
            // save trees in HSTree_list
            HSTree_list = JSON.parse(result["result"][dataListIndex]);
            //update in trees with current sensor readings
            GetTreesFirstWindow(HSTree_list, normalized_input_data);
            //Update DataList with trees
            let to_update_val = JSON.stringify(HSTree_list);
            DataListUpdateAsync(dataList_name, to_update_val).then(() => {
            //check if the season ended (our first week)
            if (lastPointInSeason_normal == 1) {
              //last hour in season 
              TrainingComplete = 1;
            }
            number_of_points_counter += 1;
            //Update cached sensor //post sensor data
            PostSensorDataAsync(cachedSensorID,FirstTraining,TrainingComplete,lastPointInSeason_sensor,FirstWeek,number_of_points_counter).then(() => {
              event.end();
            }).catch((error) => {
              event.error(error);
            });
            
      });
             
      });
    }
    //Deciding if the point is anomaly or not
     else {
        console.log("scoring");
        // Get the trees from the DataList
        DataListGetAsync(dataList_name).then((result) => {
        // Trees in HSTree_list
        HSTree_list = JSON.parse(result["result"][dataListIndex]);
        // Making Decision if point is anomaly or not
        pointAnomaly = GetPoint(normalized_input_data);
        //Update DataList
        let to_update_val = JSON.stringify(HSTree_list);
        DataListUpdateAsync(dataList_name, to_update_val).then(() => {
        //Update cached sensor //post sensor data
        PostSensorDataAsync(cachedSensorID,FirstTraining,TrainingComplete,lastPointInSeason_sensor,FirstWeek,number_of_points_counter).then(() => {
          // save results in application table
          ApplicationAddAsync(ApplicationID).then(() => {
            event.end();
          }).catch((error) => {
              event.error(error);
        });
          
        });
      }); 
  
      });
    }

  });
 

                /***********************************************
                *                 Helper Functions             *
                ************************************************/
function ApplicationAddAsync(ApplicationID){
  /*
    Function to add data to Application
  */
  return new Promise (function (done, cancel) {
    const bodyApp = {
          "AppInfo": {
            "AppId": ApplicationID,
            "SecretKey": Application_key,
          },
          "AppData": [{
            "LuxValue": input_data,
            "score": pointScore,
            "anomaly_prob":anomaly_prob,
            "anomaly": pointAnomaly,
            "season": season,
            "day": currentDay,
            "month": currentMonth
          }]
        };
    PostAppData(bodyApp, postAppData_callback);
    function postAppData_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

function PostSensorDataAsync(cachedSensorID,FirstTraining,TrainingComplete,lastPointInSeason_sensor,FirstWeek,number_of_points_counter){
  /*
   Function to update cached sensor
  */
  return new Promise (function (done, cancel) {
    const body = {
            "Auth": {
              "DriverManagerId": "1",
              "DriverManagerPassword": "123"
            },
            "Package": {
              "SensorInfo": {
                "SensorId": cachedSensorID
              },
              "SensorData": {
                "FirstTraining": FirstTraining,
                "TrainingComplete": TrainingComplete,
                "lastPointInSeason_sensor": lastPointInSeason_sensor,
                "FirstWeek": FirstWeek,
                "number_of_points_counter": number_of_points_counter
              }
            }
          };
    PostSensorData(body, postSensorData_callback);
    
    function postSensorData_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

function DataListAddAsync(name, value){
  /*
   Function to add trees to the DataList
  */
  return new Promise (function (done, cancel) {
    const dataList_object = {
      name: name,
      value: value,
      insertAt: 'tail'
    };
    DataList.add(dataList_object, dataList_callback);
    function dataList_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

function DataListGetAsync(name){
  /*
    Function to get the trees from the DataList
  */
  return new Promise (function (done, cancel) {
    const dataList_object = {
      name: name,
    };
    DataList.get(dataList_object, dataList_callback);
    function dataList_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

function DataListUpdateAsync(name, value){
  /*
    Function to Update the trees in DataList
  */
  return new Promise (function (done, cancel) {
    const dataList_object = {
      name: name,
      value: value,
      index: dataListIndex
    };
    DataList.update(dataList_object, dataList_callback);
    function dataList_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

function CachedSensorGetAsync(cachedSensorID){
  /*
    Function to get data from cached sensor
  */
  return new Promise (function (done, cancel) {
    GetLatestValueOfSensor(cachedSensorID, getLatestValue_callback);
    function getLatestValue_callback (error, result) {
      if (error) {
        return cancel(error);
      }
      done(result);
    }
  });
}

                /***********************************************
                *                 Main Functions               *
                ************************************************/

function generate_max_min(dimensions) {
  /*
    Function to generate the max & min values for each feature (dimension)
    Parameters:
          dimensions: number of dimensions (features)
    Return:
           array of array for max and min values for each feature (dimension)
  */
  //let max_arr=new Array(dimensions).fill(0);
  //let min_arr=new Array(dimensions).fill(0);
  
  let max_arr=[];
  let min_arr=[];
    
  for (let i=0; i< dimensions; i++) {
    let s_q=Math.random();
    let max_value = Math.max(s_q, 1-s_q);
    max_arr.push(s_q + 2*max_value);
    let k = s_q - 2* max_value;
    min_arr.push(k);
  }

  let max_min_arr=Array.from(Array(2), ()=> new Array(1));
  max_min_arr[0]=max_arr;
  max_min_arr[1]=min_arr;

  return max_min_arr;
}


function BuildSingleHSTree(max_arr, min_arr, level, max_depth, dimensions) {
    /*
      Function to build one single HSTree
      Parameters:
          max_arr: array containing the maximum values of each dimension "for this node (space)"
          min_arr: array containing the minimum values of each dimension "for this node (space)"
          level: The depth level of the current node
          max_depth: The maximum depth value
          dimensions: The number of dimensions
      Return:
          returns an instance of Node class
    */
  if(level==max_depth) {
    let new_node=new Node();
    new_node.level=level;
    return new_node;
  }

  let node=new Node();
  let random_dimension=Math.floor(Math.random() * dimensions);
  let mid_point=(max_arr[random_dimension] + min_arr[random_dimension])/2.0;
  let temp=max_arr[random_dimension];
  max_arr[random_dimension] = mid_point;
  node.left=BuildSingleHSTree(max_arr, min_arr, level+1, max_depth, dimensions);
  max_arr[random_dimension]=temp;
  min_arr[random_dimension]=mid_point;
  node.right=BuildSingleHSTree(max_arr, min_arr, level+1, max_depth, dimensions);
  node.split_attrib=random_dimension;
  node.split_value=mid_point;
  node.level=level;

  return node;
}

function UpdateMass(input_point, node, ref_window) {
  /*
  Function to update the mass profile of normal data in each node
  Parameters:
       input_point: An instance of data
       node: The node in an HSTree
       ref_window: Boolean value. true If the instance x is in current reference                    window. Otherwise ref_window is set to false
  Return:
       None, only update reference and latest mass profile in tree
  */
  if((node instanceof Node) || (node !== null)) {
    if(node.level != 0) {
      if (ref_window) {
        node.reference+=1;
      }
      else{ 
        node.latest+=1;
      }
    }

    if(input_point[node.split_attrib] > node.split_value) {
      node_new=node.right;
    }

    else {
      node_new=node.left;
    }

    UpdateMass(input_point, node_new, ref_window);
  } 
}


function ScoreTree(input_point, node, level) {
  /*
  Function to Calculate the anomaly score of input_point
  Parameters:
       input_point: An Instance of data
       node: The node in HSTree
       level: node depth
  Return: Anomaly score
  */
  let score=0;

  if( ! ((node instanceof Node) || (node !== null))) {
    return score;
  }
  
  //new approach to make scoring of points
  if (node.reference < number_of_points_counter*0.1 ) {
    score+= 0;
    score_list.push(0);
  } else {
    score+= parseInt(node.reference) * (2**parseInt(level));
    score_list.push(parseInt(node.reference) * (2**parseInt(level)));
  }
  

  let node_new;

  if(input_point[node.split_attrib] > node.split_value) {
    node_new=node.right;
  }

  else {
    node_new=node.left;
  }

  score+=ScoreTree(input_point, node_new, level+1);

  return score
}


function UpdateResetModel(node) {
  /*
    Helper function to reset model that put latest to reference then empty reference
  */
  if((node instanceof Node) || (node !== null)) {
    node.reference = node.latest;
    node.latest = 0;
    UpdateResetModel(node.left);
    UpdateResetModel(node.right);
  }
}

function getMaxReference(node) {
  /*
    Helper function to get maximum reference mass in trees
  */
  if((node instanceof Node) || (node !== null)) {
    referenceMasses.push(node.reference)
    getMaxReference(node.left);
    getMaxReference(node.right);
  } 
}


function GetTreesList(number_trees, dimensions, max_depth) {
  /*
  Function to build the trees and return list of the trees [List of objects]
    Parameters:
        number_trees: Number of trees
        dimensions: number of attributes (features)
        max_depth: maximum depth of each tree
    Return:
        List of the trees
  */
  //build trees and return list of trees
  let HSTree_list=[];
  let tree;

  for(let i=0; i<number_trees; i++) {
    let min_max=generate_max_min(dimensions);
    max_arr=min_max[0];
    min_arr=min_max[1];
    tree=BuildSingleHSTree(max_arr, min_arr, 0, max_depth, dimensions);
    HSTree_list.push(tree);
  }

  return HSTree_list;

}


function GetTreesFirstWindow(HSTree_list, input_point) {
  /*
    Function to update trees list values for the first window for training
    Parameters:
          HSTree_list: list of trees
          input_point: datapoint (current sensor readings)
    Return: None, only Updates in the trees
  */

  //update trees list values for the first window for training
  if (lastPointInSeason_normal!=1) { 
    //Update tree for one point then increase counter by one
    for(let tree in HSTree_list) {
      UpdateMass(input_point, HSTree_list[tree], true);
  }
}
}


function GetPoint(input_point) {
  /*
   Main Function to get the input point and calls other functions to claculate the score and anomaly probability and update the trees
   Parameter:
           input_point: input data (sensor reading)
   Return:
         pointAnomaly: 0 if anomaly, 1 if normal point
  */
  //get point to calulate scores and update trees
  let score=0;
  for(let tree in HSTree_list) {
    let score1 = score + ScoreTree(input_point, HSTree_list[tree], 0);
    UpdateMass(input_point, HSTree_list[tree], false);
  }
  //max score that can be reached in a tree
  for(let tree in HSTree_list) {
        getMaxReference(HSTree_list[tree]);
      }
  //loop to get max reference mass per each tree
  let step = referenceMasses.length / number_trees;
  
  let subsets = Array.from(Array(number_trees), ()=> new Array(1));
  let k = 0;
  for (let i =0;i<referenceMasses.length;i += step) {
    let subset = referenceMasses.slice(i, i+step);
    subsets[k] = subset;
    k += 1;
  }
  
  let maxReferenceMass = Math.max(...referenceMasses);
  let max_score = parseInt(maxReferenceMass) * (2**parseInt(max_depth));
  let votes=[]
  
  // loop over scores by the trees to push their anomaly probabilities into votes list
  let j = 0;
  for (let i =0;i<score_list.length;i+=max_depth+1){
    let temp=score_list.slice(i,i+max_depth+1); //get tree scores
    let max_in_list = Math.max(...temp); //get max for the tree

    // handle condition if score more than max per tree
    let max_score = parseInt(Math.max(...subsets[j])) * (2**parseInt(max_depth));
    
    if (max_in_list > max_score) {
      max_in_list = max_score;
    }
    
    let prob_one_tree = 1 - max_in_list/max_score; //calc anomaly probability
    votes.push(prob_one_tree); //push probability to votes list
    j += 1;
  }
  
  // get mean from votes
  let sum = 0;
  for (let i =0;i<number_trees;i++){
    //sum += votes[i];
    // round the number first then add
    sum += Math.round(votes[i] * 100) / 100
  }
  anomaly_prob = sum/number_trees; //anomaly probability for the point
  if (anomaly_prob >= anomaly_thresh) {
    pointAnomaly = 1;
  } else {
    pointAnomaly = 0;
  }
  //score of the point
  pointScore = Math.max(...score_list);
  //check if week ended to reset and update the model for trees for the full week
  if ((lastPointInSeason_normal == 1) && (lastPointInSeason_sensor == 0)) {
      if (TrainingComplete == 1 && FirstWeek == 0) {
        //last hour in season
      //latest mass is full so update reference mass and empty latest mass
      //Reset Tree
      for(let tree in HSTree_list) {
        UpdateResetModel(HSTree_list[tree]);
      }
      // Model Reset
      lastPointInSeason_sensor = 1;
      }
      
  }

  return pointAnomaly;
}

function NormalizeInputData(input_data, min, max){
  /*
    Function to Normalize input_data values to be from 0 to 1
    Parameters:
              input_data: input data from sensors
              min: minimum value for sensor data range
              max: maximum value for sensor data range
    Return:
          normalized_data: Normalized input data
  */
  let normalized_data = [];
  
  //MinMax scaling
  for (let i of input_data) {
    let normalized_i = (i - min) / (max - min);
    normalized_data.push(normalized_i);
  }
  
  return normalized_data;
}


                /*************************************************
                *                 Node class                     *
                * main class that contains data about every node *       
                **************************************************/
class Node {
  constructor(left=null, right=null, reference=0, latest=0, split_attrib=0, split_value=0.0, depth=0) {
    this.left=left; //left node from current node
    this.right=right; //right node from current node
    this.reference=reference; //reference window counter for current node
    this.latest=latest; //latest window counter for current node
    this.split_attrib=split_attrib; // the feature that this node will work on it
    this.split_value=split_value; //the value that will split the the feature
    this.level=depth; //the level of current node on the tree 
  }

}
