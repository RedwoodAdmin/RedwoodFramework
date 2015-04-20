##Redwood Experiment Framework

Welcome to the Redwood experiment framework. Redwood is a software system that allows Economics researchers to develop web-based interactive games for experimental purposes. Experimental games are developed by writing JavaScript and HTML code that runs in a web browser. During the execution of an experiment, each subject uses a web browser, such as Chrome, to interact with the game and the other subjects.

The fact that Redwood uses standard web technologies allows it to be extremely flexible, since essentially anything (from libraries and widgets, to images and graphs) that can be used in any normal website/web-application can be used in a Redwood experiment. What Redwood provides is a system to create, store, and run experiments as well as all the standard functionality that is required by all experiments including inter-subject communication and synchronization, data logging, etc.

To achieve this, Redwood consists of three main components:
  * A Django application to manage and host experiments
    * This application is written in Python and is hosted on an Apache Web Server.
  * A Router application to provide messaging between browsers and the server during an experiment
    * This application is written in GoLang and runs as a standalone process.
  * A JavaScript framework to allow an experiment developer to interact with the Redwood system.
    * This is a set of JavaScript files that are included in each experiment's HTML pages.

### Using Redwood
As an experimenter, the first step to using Redwood is to install the system on a server or personal computer. Redwood can be installed on either [Windows](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Windows-Server-Setup) or [Ubuntu Linux](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Ubuntu-Server-Setup). It is recommended to use a dedicated machine or Virtual Machine to run Redwood since it requires some configuration which might not be desirable on a general-use personal computer. These include things like running the Apache Web Server service, adding several system environment variables, etc.

Once the setup steps have been successfully completed the system should be installed and ready to use. At this point it is recommended to read the [Getting Started](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Getting-Started) page for more details on the structure of Redwood and also how to create your first experiment. The best way to start a new experiment is from an existing example experiment. A walk-through of an example experiment called Discrete Matrix is available [here](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Discrete-Matrix-Walkthrough) and a set of other example experiments is available on the [website](http://redwoodadmin.github.io/RedwoodFramework/) for download. In order to use one of these experiments, download and unzip the file, create a new experiment, and then upload the .json file to the new experiment by clicking 'Choose File' and then 'Upload Experiment'. 

## Setup Redwood
[Windows](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Windows-Server-Setup)  
[Ubuntu](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Ubuntu-Server-Setup)

## Experiment Development
[Getting Started](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Getting-Started)  
[Example Walk-through](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Discrete-Matrix-Walkthrough)  

## Example Experiments
[Discrete Matrix](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Discrete-Matrix)  
[Continuous Matrix](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Continuous-Matrix)  
[Continuous Markets](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Continuous-Markets)  
[Revealed Preferences](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Revealed-Preferences)  
[Survival](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Survival)  
[Ultimatum](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Ultimatum)  

## API Documentation
[Redwood Subject](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Redwood-Subject)  
[Timers](https://github.com/RedwoodAdmin/RedwoodFramework/wiki/Timers)  
